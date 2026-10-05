// ====================================================================
// VIEW STRATEGY — ENTITIES (HA Global Health Score)
// ====================================================================
// Opt-in view behind the "Entities" summary tile. Native gauge cards stay
// live because HA evaluates them at runtime. The zombie list is one
// markdown card whose template reads only the health sensor — it does
// not subscribe to every zombie entity and does not emit one tile each.
// ====================================================================

import type { HomeAssistant } from '../types/homeassistant';
import type { Simon42StrategyConfig } from '../types/strategy';
import type { LovelaceCardConfig, LovelaceSectionConfig, LovelaceViewConfig } from '../types/lovelace';
import { Registry } from '../Registry';
import { localize } from '../utils/localize';
import { densePlacement } from '../utils/view-builder';
import { findHealthScoreEntityId, HEALTH_SCORE_GREEN, HEALTH_SCORE_YELLOW } from '../utils/health-score';
import { defineViewStrategy } from './view-strategy-base';

/** Recommendation flags the integration exposes as booleans (v2.3+). */
const REC_FLAGS: ReadonlyArray<readonly [string, string]> = [
  ['rec_cpu_load', 'entities.rec_cpu_load'],
  ['rec_ram_pressure', 'entities.rec_ram_pressure'],
  ['rec_io_pressure', 'entities.rec_io_pressure'],
  ['rec_disk_low', 'entities.rec_disk_low'],
  ['rec_db_over_limit', 'entities.rec_db_over_limit'],
  ['rec_power_unstable', 'entities.rec_power_unstable'],
  ['rec_backup_stale', 'entities.rec_backup_stale'],
  ['rec_updates_pending', 'entities.rec_updates_pending'],
  ['rec_zombie', 'entities.rec_zombie'],
  ['rec_core_lag', 'entities.rec_core_lag'],
];

function gaugeSeverity(): { green: number; yellow: number; red: number } {
  return { green: HEALTH_SCORE_GREEN, yellow: HEALTH_SCORE_YELLOW, red: 0 };
}

function gaugeCard(entityId: string, name: string, attribute?: string): LovelaceCardConfig {
  return {
    type: 'gauge',
    entity: entityId,
    name,
    min: 0,
    max: 100,
    needle: true,
    // The integration's own card clears the unit so the dial is just the number.
    unit: ' ',
    severity: gaugeSeverity(),
    grid_options: { columns: 4 },
    ...(attribute ? { attribute } : {}),
  };
}

function heading(text: string, icon: string): LovelaceCardConfig {
  return {
    type: 'heading',
    heading: text,
    heading_style: 'title',
    icon,
    grid_options: { columns: 'full' },
  };
}

function markdown(content: string): LovelaceCardConfig {
  return {
    type: 'markdown',
    content,
    grid_options: { columns: 'full' },
  };
}

/** Jinja that lists every active rec_* flag. Labels are baked in at generate time. */
function recommendationFlagLines(): string {
  const lines: string[] = [];
  for (const [attr, key] of REC_FLAGS) {
    lines.push(`{% if state_attr(e, '${attr}') %}\n- ${localize(key)}\n{% endif %}`);
  }
  return lines.join('\n');
}

function advisorContent(entityId: string): string {
  return [
    `{% set e = '${entityId}' %}`,
    `{% set rec = state_attr(e, 'recommendations') | default('', true) %}`,
    `{% if states(e) in ['unavailable', 'unknown', 'none'] %}`,
    localize('entities.advisor_offline'),
    '{% else %}',
    `{% if rec not in [none, 'unknown', 'unavailable', ''] %}`,
    '{{ rec }}',
    '{% endif %}',
    recommendationFlagLines(),
    '{% endif %}',
  ].join('\n');
}

function recorderContent(entityId: string): string {
  return [
    `{% set e = '${entityId}' %}`,
    `{% set db = state_attr(e, 'db_size_mb') | float(0) %}`,
    `{% set keep = state_attr(e, 'recorder_keep_days') %}`,
    `{% set filter = state_attr(e, 'recorder_filter_active') | default(false, true) %}`,
    `{% set psi = state_attr(e, 'psi_available') | default(false, true) %}`,
    `{% set updates = state_attr(e, 'pending_updates') | default([], true) %}`,
    '',
    `**${localize('entities.db')}:** {{ db | round(1) }} MB{% if db == 0 %} (${localize('entities.db_external')}){% endif %}`,
    '',
    `**${localize('entities.recorder')}:** {% if keep in [none, 'unknown'] %}${localize('entities.recorder_no_purge')}{% else %}{{ keep }} ${localize('entities.days')}{% endif %}`,
    '',
    `{% if filter %}${localize('entities.filter_active')}{% else %}${localize('entities.filter_inactive')}{% endif %}`,
    '',
    `{% if psi %}${localize('entities.psi_on')}{% else %}${localize('entities.psi_off')}{% endif %}`,
    '',
    `{% if updates | length > 0 %}{{ updates | length }} ${localize('entities.updates_pending')}{% else %}${localize('entities.updates_ok')}{% endif %}`,
  ].join('\n');
}

/**
 * Domain groups come from zombie_count_per_domain (full totals). The id
 * list is read at runtime and may be shorter than zombie_count — the
 * template says so. No expand(): only this one sensor is referenced.
 */
function zombieContent(entityId: string): string {
  return [
    `{% set e = '${entityId}' %}`,
    `{% set count = state_attr(e, 'zombie_count') | int(0) %}`,
    `{% set raw = state_attr(e, 'zombie_entities') | default([], true) %}`,
    '{% if raw is string %}',
    `{% set listed = raw.split(',') | map('trim') | reject('eq', '') | list %}`,
    '{% else %}',
    '{% set listed = raw | list %}',
    '{% endif %}',
    `{% set per = state_attr(e, 'zombie_count_per_domain') %}`,
    '',
    '{% if count == 0 %}',
    localize('entities.zombies_none'),
    '{% else %}',
    `**{{ count }}** ${localize('entities.zombies_count')}`,
    '{% if per %}',
    '{% set ns = namespace(rows=[]) %}',
    '{% for dom, cnt in per.items() %}',
    `{% set ns.rows = ns.rows + ['%05d'|format(cnt|int(0)) ~ '|' ~ dom] %}`,
    '{% endfor %}',
    '{% for row in ns.rows | sort(reverse=true) %}',
    `{% set dom = row.split('|', 1)[1] %}`,
    '{% set cnt = per[dom] %}',
    '<details>',
    '<summary>{{ dom }}: {{ cnt }}</summary>',
    '',
    '{% for entry in listed %}',
    `{% set clean = entry | replace('[unregistered] ', '') %}`,
    `{% if clean.split('.')[0] == dom %}`,
    '- `{{ entry }}`',
    '{% endif %}',
    '{% endfor %}',
    '</details>',
    '{% endfor %}',
    '{% else %}',
    '{% for entry in listed %}',
    '- `{{ entry }}`',
    '{% endfor %}',
    '{% endif %}',
    '{% if count > (listed | length) %}',
    '',
    `*${localize('entities.list_partial')} ({{ listed | length }} / {{ count }})*`,
    '{% endif %}',
    '{% endif %}',
    '',
    `{% set ghost_count = state_attr(e, 'unregistered_count') | int(0) %}`,
    '{% if ghost_count > 0 %}',
    '',
    `**${localize('entities.unregistered')}:** {{ ghost_count }}`,
    "{% set ghosts = state_attr(e, 'unregistered_entities') | default([], true) %}",
    '{% if ghosts is iterable and ghosts is not string %}',
    '{% for entry in ghosts %}',
    '- `{{ entry }}`',
    '{% endfor %}',
    '{% endif %}',
    '{% endif %}',
    '',
    `{% set dead_count = state_attr(e, 'dead_device_count') | int(0) %}`,
    '{% if dead_count > 0 %}',
    '',
    `**${localize('entities.dead_devices')}:** {{ dead_count }}`,
    '{% endif %}',
    '',
    `[${localize('entities.open_entities')}](/config/entities)`,
  ].join('\n');
}

function emptySection(): LovelaceSectionConfig {
  return {
    type: 'grid',
    cards: [markdown(localize('entities.not_found'))],
  };
}

/** Sections for the Entities view. Exported for unit tests. */
export function buildEntitiesView(hass: HomeAssistant, config: Simon42StrategyConfig): LovelaceViewConfig {
  Registry.initialize(hass, config);
  const entityId = findHealthScoreEntityId();
  if (!entityId) {
    return {
      type: 'sections',
      max_columns: 2,
      ...densePlacement(config),
      sections: [emptySection()],
    };
  }

  const sections: LovelaceSectionConfig[] = [
    {
      type: 'grid',
      cards: [
        heading(localize('views.entities'), 'mdi:shield-check'),
        gaugeCard(entityId, localize('entities.score')),
        gaugeCard(entityId, localize('entities.hardware'), 'hardware_score'),
        gaugeCard(entityId, localize('entities.application'), 'application_score'),
      ],
    },
    {
      type: 'grid',
      cards: [
        heading(localize('entities.advisor'), 'mdi:lightbulb-on-outline'),
        markdown(advisorContent(entityId)),
        markdown(recorderContent(entityId)),
      ],
    },
    {
      type: 'grid',
      cards: [heading(localize('entities.zombies'), 'mdi:ghost'), markdown(zombieContent(entityId))],
    },
  ];

  return {
    type: 'sections',
    max_columns: 2,
    ...densePlacement(config),
    sections,
  };
}

async function generateEntitiesView(
  config: { config?: Simon42StrategyConfig },
  hass: HomeAssistant
): Promise<LovelaceViewConfig> {
  Registry.initialize(hass, config.config || {});
  return buildEntitiesView(hass, config.config || {});
}

defineViewStrategy('ll-strategy-simon42-view-entities', generateEntitiesView);
