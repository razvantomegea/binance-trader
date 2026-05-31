const HOUR_MS = 3_600_000;

export function getLastClosedCandleOpenTime(now = Date.now()): number {
  const currentHourOpen = Math.floor(now / HOUR_MS) * HOUR_MS;
  return currentHourOpen - HOUR_MS;
}

export { HOUR_MS };
