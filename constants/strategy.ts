export { STRATEGY_INTERVAL } from "@/constants/binance";

/** Closed candles in lookback window (latest + prior refs). */
export const STRATEGY_LOOKBACK_CLOSES = 24;

/** Block re-entry for this long after a symbol's last SELL candle. */
export const SYMBOL_REENTRY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
