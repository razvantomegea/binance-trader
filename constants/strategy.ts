import type { CandleInterval } from "@/types/binance";

/** Closed candles in lookback window (latest + prior refs). */
export const STRATEGY_LOOKBACK_CLOSES = 24;

export const STRATEGY_INTERVAL: CandleInterval = "H1";
