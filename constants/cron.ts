/** Matches Railway railway.cron.json schedule: every 5 minutes (UTC). */
export const STRATEGY_CRON_INTERVAL_MS = 5 * 60 * 1000;

/** No successful cron run after ~2 missed 5-minute slots (+ small buffer). */
export const STRATEGY_CRON_STALE_MS = 12 * 60 * 1000;

/** Strategy started but cron never recorded a run (~1 slot + buffer). */
export const STRATEGY_CRON_NO_RUN_AFTER_START_MS = 7 * 60 * 1000;
