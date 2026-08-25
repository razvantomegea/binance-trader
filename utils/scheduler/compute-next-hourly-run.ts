/** Next UTC top-of-hour after `tsMs` (exclusive of the current hour boundary). */
export function computeNextHourlyRunIso(tsMs: number): string {
  const date = new Date(tsMs);
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString();
}
