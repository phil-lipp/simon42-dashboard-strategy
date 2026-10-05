// ====================================================================
// HEALTH SCORE — HA Global Health Score (platform "haghs")
// ====================================================================
// The integration's entity id is not stable (users rename it; the unique
// id is the config-entry id). Detection is the registry platform only.
// ====================================================================

import type { HomeAssistant } from '../types/homeassistant';
import { Registry } from '../Registry';
import { stateFor } from './state-utils';

/** Integration domain / entity-registry platform. */
export const HAGHS_PLATFORM = 'haghs';

/** Score the tile shows when the sensor is missing or not numeric. */
export const HEALTH_SCORE_UNKNOWN = -1;

/** Green from this value up, matching the integration's own gauge. */
export const HEALTH_SCORE_GREEN = 90;

/** Yellow from this value up; below it the gauge is red. */
export const HEALTH_SCORE_YELLOW = 75;

/**
 * Entity id of the Global Health Score sensor, if the integration is
 * installed. Raw domain list (not the visible-entity filter): the sensor
 * is a system entity and must still be found when a dashboard filter
 * would hide it. Multiple config entries: lowest entity id, so the
 * choice is stable.
 */
export function findHealthScoreEntityId(): string | undefined {
  if (!Registry.initialized) return undefined;

  const matches: string[] = [];
  for (const id of Registry.getEntityIdsForDomain('sensor')) {
    const entry = Registry.getEntity(id);
    if (entry?.platform === HAGHS_PLATFORM) matches.push(id);
  }
  matches.sort();
  return matches.at(0);
}

/**
 * Numeric score from the sensor state, or HEALTH_SCORE_UNKNOWN when the
 * state is missing, unavailable, or not a number. 0 is a real score.
 */
export function readHealthScore(hass: HomeAssistant, entityId: string): number {
  const state = stateFor(hass, entityId);
  if (!state) return HEALTH_SCORE_UNKNOWN;
  if (state.state === 'unavailable' || state.state === 'unknown') return HEALTH_SCORE_UNKNOWN;
  const value = Number(state.state);
  if (!Number.isFinite(value)) return HEALTH_SCORE_UNKNOWN;
  return Math.round(value);
}

/** Tile / gauge color name for a score from readHealthScore. */
export function healthScoreColor(score: number): string {
  if (score < 0) return 'grey';
  if (score >= HEALTH_SCORE_GREEN) return 'green';
  if (score >= HEALTH_SCORE_YELLOW) return 'yellow';
  return 'red';
}
