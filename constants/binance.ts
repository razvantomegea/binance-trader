import type { CandleInterval } from "@/types/binance";

export function resolveBinanceApiBaseUrl(
  envValue: string | undefined = process.env.BINANCE_API_BASE_URL,
): string {
  const trimmed = envValue?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "https://data-api.binance.vision";
}

export const BINANCE_API_BASE_URL = resolveBinanceApiBaseUrl();

export const CANDLE_INTERVALS = [
  "H1",
] as const satisfies readonly CandleInterval[];

export const STRATEGY_INTERVAL = "H1" as const satisfies CandleInterval;

export const BINANCE_KLINE_INTERVAL = "1h" as const;

export const KLINE_REVALIDATE_SECONDS = 300;

export const BINANCE_FETCH_CONCURRENCY = 20;

export const INITIAL_PAPER_CASH = 10_000;
export const ENTRY_RANGE_PCT = 0.5;
export const ENTRY_RANGE_MAX_PCT = 0.75;
export const BUY_NOTIONAL_PCT = 0.05;
export const TRAILING_STOP_PCT = 0.25;
export const MAX_LOSS_PCT = 0.15;
/** @deprecated use MAX_LOSS_PCT */
export const EXIT_DRAWDOWN_PCT = MAX_LOSS_PCT;
