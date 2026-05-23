import type { BinanceKlineInterval, CandleInterval } from "@/types/binance";

export const BINANCE_API_BASE_URL = "https://api.binance.com";

export const CANDLE_INTERVALS = ["H1"] as const satisfies readonly CandleInterval[];

export const STRATEGY_INTERVAL = "H1" as const satisfies CandleInterval;

export const BINANCE_KLINE_INTERVAL: Record<CandleInterval, BinanceKlineInterval> = {
  H1: "1h",
};

export const KLINE_REVALIDATE_SECONDS: Record<CandleInterval, number> = {
  H1: 300,
};

export const BINANCE_FETCH_CONCURRENCY = 20;

export const INITIAL_PAPER_CASH = 10_000;
export const ENTRY_PUMP_PCT = 0.5;
export const BUY_NOTIONAL_PCT = 0.05;
export const STOP_LOSS_PCT = 0.15;
export const TAKE_PROFIT_PCT = 0.5;
