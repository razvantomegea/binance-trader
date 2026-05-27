import { STRATEGY_CRON_INTERVAL_MS } from "@/constants/cron";

/** Next UTC 15-minute boundary (:00, :15, :30, :45). */
export function computeNextStrategyCronRunIso(tsMs: number): string {
  const intervalStartMs =
    Math.floor(tsMs / STRATEGY_CRON_INTERVAL_MS) * STRATEGY_CRON_INTERVAL_MS;
  return new Date(intervalStartMs + STRATEGY_CRON_INTERVAL_MS).toISOString();
}
