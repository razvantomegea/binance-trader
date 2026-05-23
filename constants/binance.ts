import type { BinanceKlineInterval, CandleInterval } from "@/types/binance";

export const BINANCE_API_BASE_URL = "https://api.binance.com";

export const CANDLE_INTERVALS = ["H1", "H4", "D"] as const satisfies readonly CandleInterval[];

export const BINANCE_KLINE_INTERVAL: Record<CandleInterval, BinanceKlineInterval> = {
  H1: "1h",
  H4: "4h",
  D: "1d",
};

export const KLINE_REVALIDATE_SECONDS: Record<CandleInterval, number> = {
  H1: 300,
  H4: 900,
  D: 3600,
};

export const BINANCE_FETCH_CONCURRENCY = 20;
