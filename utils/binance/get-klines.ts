import {
  BINANCE_API_BASE_URL,
  BINANCE_KLINE_INTERVAL,
  KLINE_REVALIDATE_SECONDS,
} from "@/constants/binance";
import type {
  BinanceKline,
  CandleInterval,
  KlineCandle,
} from "@/types/binance";
import { fetchWithRetry } from "@/utils/binance/fetch-with-retry";
import { getLastClosedCandleOpenTime } from "@/utils/binance/candle-time";

interface GetKlinesParams {
  symbol: string;
  interval: CandleInterval;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

function isBinanceKline(value: unknown): value is BinanceKline {
  return Array.isArray(value) && value.length >= 5;
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
  startTime,
  endTime,
}: GetKlinesParams): Promise<KlineCandle[]> {
  const url = new URL(`${BINANCE_API_BASE_URL}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", BINANCE_KLINE_INTERVAL[interval]);
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 2), 1000)));

  if (startTime !== undefined) {
    url.searchParams.set("startTime", String(startTime));
  }
  if (endTime !== undefined) {
    url.searchParams.set("endTime", String(endTime));
  }

  const useCache = startTime === undefined && endTime === undefined;
  const response = useCache
    ? await fetch(url, {
        next: { revalidate: KLINE_REVALIDATE_SECONDS[interval] },
      })
    : await fetchWithRetry({ url });

  if (!response.ok) {
    const body = await response.text();
    const message = `Binance /klines failed: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`;
    console.error(message);
    throw new Error(message);
  }

  const klines = await response.json();
  if (!Array.isArray(klines) || !klines.every(isBinanceKline)) {
    throw new Error("Binance /klines returned invalid payload");
  }

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

  const closed = klines.length ? klines.slice(0, -1) : [];

  return closed.slice(-count).reverse();
}

const KLINE_PAGE_SIZE = 1000;

/** Closed candles ascending by openTime (excludes currently forming candle). */
export async function getHistoricalClosedKlines({
  symbol,
  interval,
  startTime,
  endTime,
}: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  endTime: number;
}): Promise<KlineCandle[]> {
  const all: KlineCandle[] = [];
  let cursor = startTime;

  while (cursor <= endTime) {
    const page = await getKlines({
      symbol,
      interval,
      limit: KLINE_PAGE_SIZE,
      startTime: cursor,
      endTime,
    });

    if (page.length === 0) {
      break;
    }

    all.push(...page);

    const lastOpenTime = page[page.length - 1]!.openTime;
    if (page.length < KLINE_PAGE_SIZE || lastOpenTime >= endTime) {
      break;
    }

    cursor = lastOpenTime + 1;
  }

  const cappedEndTime = Math.min(endTime, getLastClosedCandleOpenTime());
  return all.filter((candle) => candle.openTime <= cappedEndTime);
}
