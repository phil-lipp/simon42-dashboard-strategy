import { describe, expect, it, vi } from 'vitest';

import type { HomeAssistant } from '../../src/types/homeassistant';
import type { LovelaceCardConfig, LovelaceViewConfig } from '../../src/types/lovelace';
import type { EntityNameRule } from '../../src/types/strategy';
import {
  applyEntityNameRules,
  applyEntityNameRulesToView,
  entityNameRuleError,
  mergeStacksOrder,
  sortByFriendlyName,
} from '../../src/utils/name-utils';

function hassWith(names: Array<[string, string]>): HomeAssistant {
  const states: Record<string, unknown> = {};
  for (const [entityId, friendly] of names) {
    Reflect.set(states, entityId, {
      entity_id: entityId,
      state: 'on',
      attributes: { friendly_name: friendly },
    });
  }
  return { states } as unknown as HomeAssistant;
}

describe('mergeStacksOrder', () => {
  it('returns the default order when nothing is configured', () => {
    expect(mergeStacksOrder()).toEqual([
      'ups',
      'energy',
      'cameras',
      'lights',
      'locks',
      'climate',
      'covers',
      'covers_curtain',
      'covers_window',
      'media',
      'scenes',
      'vacuums',
      'switches',
      'misc',
      'automations',
      'scripts',
      'room_pins',
    ]);
  });

  it('keeps configured keys first and appends missing defaults', () => {
    expect(mergeStacksOrder(['lights', 'energy', 'room_pins'])).toEqual([
      'lights',
      'energy',
      'room_pins',
      'ups',
      'cameras',
      'locks',
      'climate',
      'covers',
      'covers_curtain',
      'covers_window',
      'media',
      'scenes',
      'vacuums',
      'switches',
      'misc',
      'automations',
      'scripts',
    ]);
  });

  it('drops duplicates and unknown keys', () => {
    expect(mergeStacksOrder(['lights', 'lights', 'unknown' as never, 'misc'])).toEqual([
      'lights',
      'misc',
      'ups',
      'energy',
      'cameras',
      'locks',
      'climate',
      'covers',
      'covers_curtain',
      'covers_window',
      'media',
      'scenes',
      'vacuums',
      'switches',
      'automations',
      'scripts',
      'room_pins',
    ]);
  });
});

describe('applyEntityNameRules', () => {
  const prefix: EntityNameRule[] = [{ pattern: "^Socket - Phillipp's " }];

  it('leaves the name unchanged when no rules are configured', () => {
    expect(applyEntityNameRules("Socket - Phillipp's TV", undefined)).toBe("Socket - Phillipp's TV");
    expect(applyEntityNameRules("Socket - Phillipp's TV", [])).toBe("Socket - Phillipp's TV");
  });

  it('strips a prefix so only the remainder is shown', () => {
    expect(applyEntityNameRules("Socket - Phillipp's TV", prefix)).toBe('TV');
  });

  it('replaces with capture groups', () => {
    expect(applyEntityNameRules('Living - TV', [{ pattern: '^(.*) - (.*)$', replace: '$2' }])).toBe('TV');
  });

  it('applies rules in order', () => {
    expect(
      applyEntityNameRules("Socket - Phillipp's TV", [
        { pattern: "^Socket - Phillipp's " },
        { pattern: '^TV$', replace: 'Television' },
      ])
    ).toBe('Television');
  });

  it('skips rules for other domains', () => {
    const rules: EntityNameRule[] = [{ pattern: '^Socket - ', domains: ['light'] }];
    expect(applyEntityNameRules('Socket - TV', rules, 'switch')).toBe('Socket - TV');
    expect(applyEntityNameRules('Socket - TV', rules, 'light')).toBe('TV');
  });

  it('honours the i and g flags', () => {
    expect(applyEntityNameRules('socket - TV', [{ pattern: '^socket - ', flags: 'i' }])).toBe('TV');
    expect(applyEntityNameRules('aa', [{ pattern: 'a', flags: 'g', replace: 'b' }])).toBe('bb');
    expect(applyEntityNameRules('aa', [{ pattern: 'a', replace: 'b' }])).toBe('ba');
  });

  it('keeps the previous name when a rule would wipe it', () => {
    expect(applyEntityNameRules('TV', [{ pattern: '.*' }])).toBe('TV');
  });

  it('skips an invalid pattern and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(applyEntityNameRules('TV', [{ pattern: '([' }])).toBe('TV');
    expect(applyEntityNameRules('TV', [{ pattern: '([' }])).toBe('TV');
    const messages = warn.mock.calls.map((call) => String(call.at(0)));
    expect(messages.filter((message) => message.includes('([')).length).toBe(1);
    warn.mockRestore();
  });

  it('ignores rules past the cap of 30', () => {
    const rules: EntityNameRule[] = [];
    for (let i = 0; i < 30; i++) {
      rules.push({ pattern: `nomatch${i}` });
    }
    rules.push({ pattern: '^Socket - ' });
    expect(applyEntityNameRules('Socket - TV', rules)).toBe('Socket - TV');
  });

  it('rejects illegal flags and over-long patterns in the editor helper', () => {
    expect(entityNameRuleError('')).toBeUndefined();
    expect(entityNameRuleError('(')?.code).toBe('invalid');
    expect(entityNameRuleError('Socket', 'x')?.code).toBe('bad_flags');
    expect(entityNameRuleError('a'.repeat(201))?.code).toBe('too_long');
  });

  it('sorts by the rewritten name when rules are present', () => {
    const hass = hassWith([
      ['switch.alpha', 'Socket - Alpha'],
      ['sensor.middle', 'Middle'],
    ]);
    const rules: EntityNameRule[] = [{ pattern: '^Socket - ' }];
    expect(sortByFriendlyName('switch.alpha', 'sensor.middle', hass)).toBeGreaterThan(0);
    expect(sortByFriendlyName('switch.alpha', 'sensor.middle', hass, rules)).toBeLessThan(0);
  });
});

describe('applyEntityNameRulesToView', () => {
  const rules: EntityNameRule[] = [{ pattern: "^Socket - Phillipp's " }];

  function sampleView(): LovelaceViewConfig {
    return {
      path: 'home',
      sections: [
        {
          cards: [
            { type: 'tile', entity: 'switch.tv' },
            { type: 'tile', entity: 'light.kitchen' },
            { type: 'heading', heading: 'Lights' },
            { type: 'tile', entity: 'switch.tv', name: "Socket - Phillipp's TV" },
            {
              type: 'picture-glance',
              camera_image: 'camera.tv',
              title: "Socket - Phillipp's TV",
            },
          ],
        },
      ],
    };
  }

  it('returns the same view when no rules are configured', () => {
    const view = sampleView();
    expect(applyEntityNameRulesToView(view, hassWith([]), undefined)).toBe(view);
    expect(applyEntityNameRulesToView(view, hassWith([]), [])).toBe(view);
  });

  it('sets a name only when a rule matches, and rewrites titles that are already set', () => {
    const view = sampleView();
    const hass = hassWith([
      ['switch.tv', "Socket - Phillipp's TV"],
      ['light.kitchen', 'Kitchen'],
      ['camera.tv', "Socket - Phillipp's TV"],
    ]);
    const next = applyEntityNameRulesToView(view, hass, rules);
    const cards = next.sections?.at(0)?.cards ?? [];
    const unnamed = cards.at(0) as LovelaceCardConfig;
    const kitchen = cards.at(1) as LovelaceCardConfig;
    const heading = cards.at(2) as LovelaceCardConfig;
    const named = cards.at(3) as LovelaceCardConfig;
    const glance = cards.at(4) as LovelaceCardConfig;

    expect(unnamed.name).toBe('TV');
    expect(kitchen.name).toBeUndefined();
    expect(kitchen).toBe(view.sections?.at(0)?.cards?.at(1));
    expect(heading).toEqual({ type: 'heading', heading: 'Lights' });
    expect(heading).toBe(view.sections?.at(0)?.cards?.at(2));
    expect(named.name).toBe('TV');
    expect(glance.title).toBe('TV');
  });
});
