import type { Survey } from '../services/api';

/**
 * Module-level cache of surveys keyed by waypoint symbol.
 * Persists across component mounts/unmounts and ship switches.
 */
const cache = new Map<string, Survey[]>();

/** Prune expired surveys from a list, returning only active ones. */
function pruneExpired(surveys: Survey[]): Survey[] {
  const now = Date.now();
  return surveys.filter((s) => new Date(s.expiration).getTime() > now);
}

/** Get active surveys for a waypoint. */
export function getSurveys(waypoint: string): Survey[] {
  const stored = cache.get(waypoint);
  if (!stored) return [];
  const active = pruneExpired(stored);
  if (active.length !== stored.length) {
    if (active.length === 0) cache.delete(waypoint);
    else cache.set(waypoint, active);
  }
  return active;
}

/** Replace the full survey list for a waypoint. */
export function setSurveys(waypoint: string, surveys: Survey[]): void {
  const active = pruneExpired(surveys);
  if (active.length === 0) cache.delete(waypoint);
  else cache.set(waypoint, active);
}

/** Add surveys to a waypoint (e.g. after a survey action). */
export function addSurveys(waypoint: string, newSurveys: Survey[]): Survey[] {
  const existing = getSurveys(waypoint);
  const merged = [...existing, ...newSurveys];
  setSurveys(waypoint, merged);
  return getSurveys(waypoint);
}

/** Remove a specific survey by signature from a waypoint. */
export function removeSurvey(waypoint: string, signature: string): Survey[] {
  const remaining = getSurveys(waypoint).filter((s) => s.signature !== signature);
  setSurveys(waypoint, remaining);
  return remaining;
}
