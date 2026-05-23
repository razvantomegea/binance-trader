import {
  BINANCE_API_BASE_URL,
  BINANCE_KLINE_INTERVAL,
  KLINE_REVALIDATE_SECONDS,
} from "@/constants/binance";
import type { BinanceKline, CandleInterval, KlineCandle } from "@/types/binance";

interface GetKlinesParams {
  symbol: string;
  interval: CandleInterval;
  limit?: number;
}

function parseKline(kline: BinanceKline): KlineCandle {
  return {
    openTime: kline[0],
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
  };
}

export async function getKlines({
  symbol,
  interval,
  limit = 200,
}: GetKlinesParams): Promise<KlineCandle[]> {
  const url = new URL(`${BINANCE_API_BASE_URL}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", BINANCE_KLINE_INTERVAL[interval]);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 2), 1000)));

  const response = await fetch(url, {
    next: { revalidate: KLINE_REVALIDATE_SECONDS[interval] },
  });

  if (!response.ok) {
    return [];
  }

  const klines = (await response.json()) as BinanceKline[];
  return klines.map(parseKline);
}

export async function getLatestClosedKline({
  symbol,
  interval,
}: {
  symbol: string;
  interval: CandleInterval;
}): Promise<KlineCandle | null> {
  const closed = await getRecentClosedKlines({ symbol, interval, count: 1 });
  return closed[0] ?? null;
}

/** Most recent closed candles first (excludes the currently forming candle). */
export async function getRecentClosedKlines({
  symbol,
  interval,
  count,
}: {
  symbol: string;
  interval: CandleInterval;
  count: number;
}): Promise<KlineCandle[]> {
  const klines = await getKlines({ symbol, interval, limit: count + 1 });

  if (klines.length === 0) {
    return [];
  }

  const closed =
    klines.length > 1 ? klines.slice(0, -1) : klines;

  return closed.slice(-count).reverse();
}
