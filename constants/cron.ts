/** Strategy evaluates once per closed H1 candle (top of UTC hour). */
export const STRATEGY_CRON_INTERVAL_MS = 60 * 60 * 1000;

/** In-process poll interval; also the UTC window after :00 that may run H1. */
export const STRATEGY_HEARTBEAT_MS = 5 * 60 * 1000;

/** No successful run after ~2 missed hourly slots (+ small buffer). */
export const STRATEGY_CRON_STALE_MS = 70 * 60 * 1000;

/** Strategy started but no run recorded yet (~1 missed hour + buffer). */
export const STRATEGY_CRON_NO_RUN_AFTER_START_MS = 70 * 60 * 1000;
