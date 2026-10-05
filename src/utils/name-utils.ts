// ====================================================================
// Name & Entity Utility Functions
// ====================================================================
// Ported from dist/utils/simon42-helpers.js with full TypeScript types,
// module-level RegExp caches, and regex-escaping for area names.
// ====================================================================

import { Registry } from '../Registry';
import type { HomeAssistant } from '../types/homeassistant';
import type {
  LovelaceBadgeConfig,
  LovelaceCardConfig,
  LovelaceSectionConfig,
  LovelaceViewConfig,
} from '../types/lovelace';
import type { AreaRegistryEntry, EntityRegistryEntry } from '../types/registries';
import { DEFAULT_STACKS_ORDER, type AreasDisplay, type EntityNameRule, type StackKey } from '../types/strategy';

// -- Module-level RegExp caches (shared across all calls) -------------

interface AreaRegExps {
  start: RegExp;
  end: RegExp;
  middle: RegExp;
}

const _areaRegExpCache = new Map<string, AreaRegExps>();

const _coverTypeRegExps: RegExp[] = [
  'Rollo',
  'Rollos',
  'Rolladen',
  'Rolläden',
  'Vorhang',
  'Vorhänge',
  'Jalousie',
  'Jalousien',
  'Shutter',
  'Shutters',
  'Blind',
  'Blinds',
].map((type) => new RegExp(`\\b${type}\\b`, 'gi'));

// -- Helper: escape special regex characters --------------------------

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// -- Helper: extract friendly name or fallback from entity ID ---------

function getFriendlyName(entityId: string, hass: HomeAssistant): string | null {
  const state = hass.states[entityId];
  if (!state) return null;
  return (state.attributes?.friendly_name as string | undefined) ?? entityId.split('.')[1].replace(/_/g, ' ');
}

// -- Exported functions -----------------------------------------------

/**
 * Strips the area name from an entity's friendly name.
 * Uses cached, regex-escaped patterns per area name to avoid recompilation
 * and prevent bugs with special characters in area names.
 */
export function stripAreaName(entityId: string, area: AreaRegistryEntry, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  if (!state) return entityId;

  const name = getFriendlyName(entityId, hass);
  if (!name) return entityId;

  const areaName = area.name;
  if (!areaName) return name;

  // Build and cache RegExps for this area name (compiled once, reused)
  if (!_areaRegExpCache.has(areaName)) {
    const escaped = escapeRegExp(areaName);
    _areaRegExpCache.set(areaName, {
      start: new RegExp(`^${escaped}\\s+`, 'i'),
      end: new RegExp(`\\s+${escaped}$`, 'i'),
      middle: new RegExp(`\\s+${escaped}\\s+`, 'i'),
    });
  }

  const re = _areaRegExpCache.get(areaName);
  if (!re) return name;
  const cleanName = name.replace(re.start, '').replace(re.end, '').replace(re.middle, ' ').trim();

  // Only use cleaned name if something meaningful remains
  if (cleanName.length > 0 && cleanName.toLowerCase() !== areaName.toLowerCase()) {
    return cleanName;
  }

  return name;
}

/**
 * Strips cover type terms (Rollo, Jalousie, Shutter, etc.) from an entity's
 * friendly name. Uses pre-compiled RegExps for performance.
 */
export function stripCoverType(entityId: string, hass: HomeAssistant): string {
  const state = hass.states[entityId];
  if (!state) return entityId;

  let name = getFriendlyName(entityId, hass);
  if (!name) return entityId;

  // Remove cover type terms using pre-compiled patterns
  for (const regex of _coverTypeRegExps) {
    regex.lastIndex = 0;
    name = name.replace(regex, '').trim();
  }

  // Collapse multiple whitespace
  name = name.replace(/\s+/g, ' ').trim();

  // Only use cleaned name if something meaningful remains
  if (name.length > 0) {
    return name;
  }

  // Fallback to original friendly name
  return (state.attributes?.friendly_name as string | undefined) ?? entityId.split('.')[1].replace(/_/g, ' ');
}

/**
 * Filters areas based on display configuration (hidden list) and sorts them
 * by the configured order or alphabetically as fallback.
 */
export function getVisibleAreas(
  areas: AreaRegistryEntry[],
  displayConfig?: AreasDisplay,
  useDefaultSort?: boolean
): AreaRegistryEntry[] {
  const hiddenAreas = displayConfig?.hidden ?? [];

  // Filter out hidden areas
  const visibleAreas = areas.filter((area) => !hiddenAreas.includes(area.area_id));

  // If useDefaultSort is true, use HA's native area order (as-is from registry)
  if (useDefaultSort) {
    return visibleAreas;
  }

  const orderConfig = displayConfig?.order ?? [];

  // Sort by configured order, then alphabetically for unordered
  if (orderConfig.length > 0) {
    visibleAreas.sort((a, b) => {
      const indexA = orderConfig.indexOf(a.area_id);
      const indexB = orderConfig.indexOf(b.area_id);

      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  } else {
    visibleAreas.sort((a, b) => a.name.localeCompare(b.name));
  }

  return visibleAreas;
}

/**
 * Like getVisibleAreas but reads from hass.areas (synchronous Record)
 * instead of Registry.areas (requires WebSocket init).
 * Used by the dashboard entry point to avoid blocking on Registry.
 */
export function getVisibleAreasFromHass(
  hass: HomeAssistant,
  displayConfig?: AreasDisplay,
  useDefaultSort?: boolean
): AreaRegistryEntry[] {
  return getVisibleAreas(Object.values(hass.areas), displayConfig, useDefaultSort);
}

/**
 * Checks whether an entity should be excluded from the dashboard based on
 * its registry flags: hidden, entity_category, labels, and config.
 *
 * Delegates to Registry.isEntityExcludedWithStateCategory() which covers
 * all exclusion criteria including state attribute fallback.
 */
export function isEntityHiddenOrDisabled(entity: EntityRegistryEntry, _hass: HomeAssistant): boolean {
  return Registry.isEntityExcludedWithStateCategory(entity.entity_id);
}

/**
 * Comparator that sorts entity IDs by last_changed timestamp,
 * most recently changed first.
 */
export function sortByLastChanged(a: string, b: string, hass: HomeAssistant): number {
  const stateA = hass.states[a];
  const stateB = hass.states[b];
  if (!stateA || !stateB) return 0;

  const dateA = new Date(stateA.last_changed).getTime();
  const dateB = new Date(stateB.last_changed).getTime();
  return dateB - dateA; // Newest first
}

/**
 * Comparator: sort entities alphabetically by friendly name (fallback:
 * entity_id). Locale-aware compare so umlauts sort naturally.
 */
export function sortByFriendlyName(a: string, b: string, hass: HomeAssistant, rules?: EntityNameRule[]): number {
  return sortLabel(a, hass, rules).localeCompare(sortLabel(b, hass, rules));
}

function sortLabel(entityId: string, hass: HomeAssistant, rules?: EntityNameRule[]): string {
  const friendly = friendlyNameOf(hass, entityId) || entityId;
  if (!rules || rules.length === 0) return friendly;
  return applyEntityNameRules(friendly, rules, domainOf(entityId));
}

function mergeConfiguredOrder<T extends string>(stored: T[] | undefined, defaults: readonly T[]): T[] {
  if (!stored || stored.length === 0) return [...defaults];

  const validKeys = new Set(defaults);
  const seen = new Set<T>();
  const known: T[] = [];

  for (const key of stored) {
    if (!validKeys.has(key) || seen.has(key)) continue;
    known.push(key);
    seen.add(key);
  }

  return [...known, ...defaults.filter((key) => !seen.has(key))];
}

export function mergeStacksOrder(stored?: StackKey[]): StackKey[] {
  return mergeConfiguredOrder(stored, DEFAULT_STACKS_ORDER);
}

// -- User display-name rules ------------------------------------------

const MAX_NAME_RULES = 30;
const MAX_NAME_PATTERN_LENGTH = 200;

const _compiledNameRules = new Map<string, RegExp | null>();
const _nameRuleWarnings = new Set<string>();

export interface EntityNameRuleProblem {
  code: 'too_long' | 'bad_flags' | 'invalid';
  detail?: string;
}

function warnNameRule(key: string, message: string): void {
  if (_nameRuleWarnings.has(key)) return;
  _nameRuleWarnings.add(key);
  console.warn(`[simon42] ${message}`);
}

function domainOf(entityId: string): string {
  const dot = entityId.indexOf('.');
  return dot === -1 ? '' : entityId.slice(0, dot);
}

function friendlyNameOf(hass: HomeAssistant, entityId: string): string | undefined {
  const state = Reflect.get(hass.states, entityId) as { attributes?: { friendly_name?: unknown } } | undefined;
  const name = state?.attributes?.friendly_name;
  return typeof name === 'string' && name.length > 0 ? name : undefined;
}

function sanitizeNameRuleFlags(flags: string | undefined): string {
  if (typeof flags !== 'string' || flags.length === 0) return '';
  let out = '';
  if (flags.includes('i')) out += 'i';
  if (flags.includes('g')) out += 'g';
  if (flags.includes('m')) out += 'm';
  if (flags.includes('u')) out += 'u';
  return out;
}

function flagsAreLegal(flags: string | undefined): boolean {
  if (typeof flags !== 'string' || flags.length === 0) return true;
  for (const ch of flags) {
    if (ch !== 'i' && ch !== 'g' && ch !== 'm' && ch !== 'u') return false;
  }
  return true;
}

function compiledNameRule(pattern: string, flags: string): RegExp | null {
  if (pattern.length > MAX_NAME_PATTERN_LENGTH) {
    warnNameRule(
      `len:${pattern.slice(0, 40)}`,
      `skipping entity_name_rules pattern longer than ${MAX_NAME_PATTERN_LENGTH} characters`
    );
    return null;
  }
  const key = `${flags}\n${pattern}`;
  if (_compiledNameRules.has(key)) return _compiledNameRules.get(key) ?? null;
  try {
    const regex = new RegExp(pattern, flags);
    _compiledNameRules.set(key, regex);
    return regex;
  } catch (error: unknown) {
    _compiledNameRules.set(key, null);
    const detail = error instanceof Error ? error.message : 'invalid pattern';
    warnNameRule(key, `skipping invalid entity_name_rules pattern /${pattern}/: ${detail}`);
    return null;
  }
}

function nameRuleMatchesDomain(rule: EntityNameRule, domain: string): boolean {
  if (!Array.isArray(rule.domains) || rule.domains.length === 0) return true;
  for (const entry of rule.domains) {
    if (typeof entry === 'string' && entry.toLowerCase() === domain) return true;
  }
  return false;
}

/** Read `entity_name_rules` off a dashboard config object without a dynamic key lookup. */
export function dashboardNameRules(config: unknown): EntityNameRule[] | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const rules = Reflect.get(config, 'entity_name_rules');
  if (!Array.isArray(rules) || rules.length === 0) return undefined;
  return rules as EntityNameRule[];
}

/**
 * Apply configured display-name rules in order.
 * A rule that would erase the name is skipped. Whitespace is collapsed
 * once, after a rule has actually changed the string.
 */
export function applyEntityNameRules(name: string, rules: EntityNameRule[] | undefined, domain?: string): string {
  if (!rules || rules.length === 0 || typeof name !== 'string' || name.length === 0) return name;
  if (rules.length > MAX_NAME_RULES) {
    warnNameRule('cap', `entity_name_rules limited to the first ${MAX_NAME_RULES} entries`);
  }

  const entityDomain = domain ?? '';
  let current = name;
  let changed = false;
  for (const rule of rules.slice(0, MAX_NAME_RULES)) {
    if (!rule || typeof rule.pattern !== 'string' || rule.pattern.length === 0) continue;
    if (!nameRuleMatchesDomain(rule, entityDomain)) continue;
    if (!flagsAreLegal(rule.flags)) {
      warnNameRule(
        `flags:${String(rule.flags)}`,
        `skipping entity_name_rules flags "${String(rule.flags)}" (allowed: i, g, m, u)`
      );
      continue;
    }
    const flags = sanitizeNameRuleFlags(rule.flags);
    const regex = compiledNameRule(rule.pattern, flags);
    if (!regex) continue;
    regex.lastIndex = 0;
    const replacement = typeof rule.replace === 'string' ? rule.replace : '';
    const replaced = current.replace(regex, replacement);
    if (replaced === current) continue;
    if (replaced.replace(/\s+/g, ' ').trim().length === 0) continue;
    current = replaced;
    changed = true;
  }

  if (!changed) return name;
  const collapsed = current.replace(/\s+/g, ' ').trim();
  return collapsed.length === 0 ? name : collapsed;
}

/** Editor validation. Does not warn — the panel shows the problem inline. */
export function entityNameRuleError(pattern: string, flags?: string): EntityNameRuleProblem | undefined {
  if (typeof pattern !== 'string' || pattern.length === 0) return undefined;
  if (pattern.length > MAX_NAME_PATTERN_LENGTH) return { code: 'too_long' };
  if (!flagsAreLegal(flags)) return { code: 'bad_flags' };
  try {
    new RegExp(pattern, sanitizeNameRuleFlags(flags));
    return undefined;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'invalid pattern';
    return { code: 'invalid', detail };
  }
}

function isLovelaceCard(value: unknown): value is LovelaceCardConfig {
  return !!value && typeof value === 'object' && typeof (value as LovelaceCardConfig).type === 'string';
}

function entityIdOf(node: LovelaceCardConfig): string | undefined {
  if (typeof node.entity === 'string' && node.entity.includes('.')) return node.entity;
  if (node.type === 'picture-glance' && typeof node.camera_image === 'string' && node.camera_image.includes('.')) {
    return node.camera_image;
  }
  return undefined;
}

function rewriteName(node: LovelaceCardConfig, hass: HomeAssistant, rules: EntityNameRule[]): LovelaceCardConfig {
  const entityId = entityIdOf(node);
  if (!entityId) return node;
  const domain = domainOf(entityId);
  if (typeof node.name === 'string') {
    const rewritten = applyEntityNameRules(node.name, rules, domain);
    if (rewritten === node.name) return node;
    return { ...node, name: rewritten };
  }
  const friendly = friendlyNameOf(hass, entityId);
  if (!friendly) return node;
  const rewritten = applyEntityNameRules(friendly, rules, domain);
  if (rewritten === friendly) return node;
  return { ...node, name: rewritten };
}

function rewriteGlanceTitle(
  node: LovelaceCardConfig,
  hass: HomeAssistant,
  rules: EntityNameRule[]
): LovelaceCardConfig {
  const entityId = entityIdOf(node);
  if (!entityId) return node;
  const domain = domainOf(entityId);
  if (typeof node.title === 'string') {
    const rewritten = applyEntityNameRules(node.title, rules, domain);
    if (rewritten === node.title) return node;
    return { ...node, title: rewritten };
  }
  const friendly = friendlyNameOf(hass, entityId);
  if (!friendly) return node;
  const rewritten = applyEntityNameRules(friendly, rules, domain);
  if (rewritten === friendly) return node;
  return { ...node, title: rewritten };
}

function rewriteNamedEntity(
  node: LovelaceCardConfig,
  hass: HomeAssistant,
  rules: EntityNameRule[]
): LovelaceCardConfig {
  if (node.type === 'picture-glance') return rewriteGlanceTitle(node, hass, rules);
  return rewriteName(node, hass, rules);
}

function mapIfChanged<T>(items: readonly T[], mapFn: (item: T) => T): T[] | null {
  const next: T[] = [];
  let changed = false;
  for (const item of items) {
    const mapped = mapFn(item);
    if (mapped !== item) changed = true;
    next.push(mapped);
  }
  return changed ? next : null;
}

function applyToEntityListItem(
  item: string | LovelaceCardConfig,
  hass: HomeAssistant,
  rules: EntityNameRule[]
): string | LovelaceCardConfig {
  if (typeof item !== 'object' || !item) return item;
  return rewriteNamedEntity(item, hass, rules);
}

function applyToBadge(
  badge: string | Partial<LovelaceBadgeConfig>,
  hass: HomeAssistant,
  rules: EntityNameRule[]
): string | Partial<LovelaceBadgeConfig> {
  if (typeof badge === 'string') {
    if (!badge.includes('.')) return badge;
    const friendly = friendlyNameOf(hass, badge);
    if (!friendly) return badge;
    const rewritten = applyEntityNameRules(friendly, rules, domainOf(badge));
    if (rewritten === friendly) return badge;
    return { type: 'entity', entity: badge, name: rewritten };
  }
  if (!badge || typeof badge !== 'object') return badge;
  return rewriteNamedEntity(badge as LovelaceCardConfig, hass, rules);
}

function applyToCard(card: LovelaceCardConfig, hass: HomeAssistant, rules: EntityNameRule[]): LovelaceCardConfig {
  let next = card;

  if (Array.isArray(card.cards)) {
    const cards = mapIfChanged(card.cards, (child) => applyToCard(child, hass, rules));
    if (cards) next = { ...next, cards };
  }

  const nested = card.card;
  if (isLovelaceCard(nested)) {
    const mapped = applyToCard(nested, hass, rules);
    if (mapped !== nested) next = { ...next, card: mapped };
  }

  if (Array.isArray(card.entities)) {
    const entities = mapIfChanged(card.entities, (item: string | LovelaceCardConfig) =>
      applyToEntityListItem(item, hass, rules)
    );
    if (entities) next = { ...next, entities };
  }

  if (Array.isArray(card.badges)) {
    const badges = mapIfChanged(card.badges, (badge: string | Partial<LovelaceBadgeConfig>) =>
      applyToBadge(badge, hass, rules)
    );
    if (badges) next = { ...next, badges };
  }

  return rewriteNamedEntity(next, hass, rules);
}

function applyToSection(
  section: LovelaceSectionConfig,
  hass: HomeAssistant,
  rules: EntityNameRule[]
): LovelaceSectionConfig {
  if (!Array.isArray(section.cards)) return section;
  const cards = mapIfChanged(section.cards, (card) => applyToCard(card, hass, rules));
  if (!cards) return section;
  return { ...section, cards };
}

/**
 * Rewrite entity names on one generated view. No-op (same reference) when
 * no rules are configured. Headings and cards without an entity are left
 * alone. A tile keeps Home Assistant's native name unless a rule changes it.
 */
export function applyEntityNameRulesToView(
  view: LovelaceViewConfig,
  hass: HomeAssistant,
  rules: EntityNameRule[] | undefined
): LovelaceViewConfig {
  if (!rules || rules.length === 0) return view;

  let next = view;
  if (Array.isArray(view.badges)) {
    const badges = mapIfChanged(view.badges, (badge) => applyToBadge(badge, hass, rules));
    if (badges) next = { ...next, badges };
  }
  if (Array.isArray(view.sections)) {
    const sections = mapIfChanged(view.sections, (section) => applyToSection(section, hass, rules));
    if (sections) next = { ...next, sections };
  }
  if (Array.isArray(view.cards)) {
    const cards = mapIfChanged(view.cards, (card) => applyToCard(card, hass, rules));
    if (cards) next = { ...next, cards };
  }
  if (view.sidebar && Array.isArray(view.sidebar.sections)) {
    const sections = mapIfChanged(view.sidebar.sections, (section) => applyToSection(section, hass, rules));
    if (sections) next = { ...next, sidebar: { ...view.sidebar, sections } };
  }
  return next;
}
