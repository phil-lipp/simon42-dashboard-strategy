// ============================================================================
// Tests — Entities view (HA Global Health Score)
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';

import { buildEntitiesView } from '../../src/views/EntitiesViewStrategy';
import { findHealthScoreEntityId, HEALTH_SCORE_UNKNOWN, readHealthScore } from '../../src/utils/health-score';
import { Registry } from '../../src/Registry';
import { makeHass, type HassFixtureSpec } from '../fixtures/hass';
import type { HomeAssistant } from '../../src/types/homeassistant';
import type { LovelaceCardConfig, LovelaceViewConfig } from '../../src/types/lovelace';

function init(spec: HassFixtureSpec): HomeAssistant {
  const hass = makeHass(spec);
  Registry.resetForTesting();
  Registry.initialize(hass, {});
  return hass;
}

function cardsOf(view: LovelaceViewConfig): LovelaceCardConfig[] {
  const cards: LovelaceCardConfig[] = [];
  for (const section of view.sections ?? []) {
    for (const card of section.cards ?? []) cards.push(card);
  }
  return cards;
}

beforeEach(function resetRegistry() {
  Registry.resetForTesting();
});

describe('findHealthScoreEntityId', () => {
  it('finds the sensor by platform, ignoring a similarly named entity', () => {
    init({
      entities: [
        { entity_id: 'sensor.system_ha_global_health_score', platform: 'template', state: '10' },
        { entity_id: 'sensor.renamed_health', platform: 'haghs', state: '88' },
      ],
    });
    expect(findHealthScoreEntityId()).toBe('sensor.renamed_health');
  });

  it('returns undefined when the integration is not installed', () => {
    init({ entities: [{ entity_id: 'sensor.temperature', platform: 'mqtt', state: '21' }] });
    expect(findHealthScoreEntityId()).toBeUndefined();
  });
});

describe('readHealthScore', () => {
  it('keeps a real score of 0 and treats unavailable as unknown', () => {
    const zero = init({ entities: [{ entity_id: 'sensor.health', platform: 'haghs', state: '0' }] });
    expect(readHealthScore(zero, 'sensor.health')).toBe(0);

    const down = init({
      entities: [{ entity_id: 'sensor.health', platform: 'haghs', state: 'unavailable' }],
    });
    expect(readHealthScore(down, 'sensor.health')).toBe(HEALTH_SCORE_UNKNOWN);
  });
});

describe('buildEntitiesView', () => {
  it('shows an empty card when the sensor is missing', () => {
    const hass = init({ entities: [{ entity_id: 'light.kitchen', state: 'on' }] });
    const cards = cardsOf(buildEntitiesView(hass, { show_entities_summary: true }));
    expect(
      cards.some(function isGauge(card) {
        return card.type === 'gauge';
      })
    ).toBe(false);
    expect(cards.at(0)).toMatchObject({ type: 'markdown' });
    expect(String(cards.at(0)?.content)).toContain('No HA Global Health Score sensor found');
  });

  it('emits three gauges and does not emit one card per zombie', () => {
    const hass = init({
      entities: [
        {
          entity_id: 'sensor.renamed_health',
          platform: 'haghs',
          state: '88',
          attributes: {
            hardware_score: 100,
            application_score: 80,
            zombie_count: 185,
            zombie_entities: ['sensor.zombie_one', 'switch.zombie_two'],
            zombie_count_per_domain: { sensor: 49, switch: 38 },
          },
        },
      ],
    });
    const view = buildEntitiesView(hass, { show_entities_summary: true });
    const cards = cardsOf(view);
    const gauges = cards.filter(function isGauge(card) {
      return card.type === 'gauge';
    });

    expect(gauges).toHaveLength(3);
    expect(
      gauges.map(function gaugeKind(card) {
        return card.attribute ?? 'state';
      })
    ).toEqual(['state', 'hardware_score', 'application_score']);
    expect(gauges.at(0)?.severity).toEqual({ green: 90, yellow: 75, red: 0 });
    expect(
      gauges.every(function sameEntity(card) {
        return card.entity === 'sensor.renamed_health';
      })
    ).toBe(true);
    expect(
      cards.some(function isTile(card) {
        return card.type === 'tile';
      })
    ).toBe(false);

    const dumped = JSON.stringify(view);
    expect(dumped).toContain('zombie_count_per_domain');
    expect(dumped).not.toContain('sensor.zombie_one');
  });
});
