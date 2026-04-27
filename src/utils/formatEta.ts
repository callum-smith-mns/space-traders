/** Format a duration in seconds into a human-readable ETA string.
 *  - Under 60s:  "42s"
 *  - Under 1h:   "3m 12s"
 *  - 1h+:        "2h 15m"
 */
export function formatEta(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
