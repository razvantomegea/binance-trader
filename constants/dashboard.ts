/** Dashboard refresh interval. Kept well above cron (5 min) to limit Neon compute wake-ups. */
export const DASHBOARD_POLL_MS = 2 * 60 * 1000;
