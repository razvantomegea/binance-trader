/** Matches Railway railway.cron.json schedule: every 15 minutes (UTC). */
export const STRATEGY_CRON_INTERVAL_MS = 15 * 60 * 1000;

/** No successful cron run after ~2 missed 15-minute slots. */
export const STRATEGY_CRON_STALE_MS = 40 * 60 * 1000;

/** Strategy started but cron never recorded a run (~1 slot + buffer). */
export const STRATEGY_CRON_NO_RUN_AFTER_START_MS = 25 * 60 * 1000;
