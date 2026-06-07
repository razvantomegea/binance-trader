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
import {
  findReusableHistoricalKlinesCache,
  writeHistoricalKlinesCache,
} from "@/utils/binance/historical-klines-cache";
import {
  getLastClosedCandleOpenTime,
  HOUR_MS,
} from "@/utils/binance/candle-time";

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
  interval: _interval,
  limit = 200,
  startTime,
  endTime,
}: GetKlinesParams): Promise<KlineCandle[]> {
  const url = new URL(`${BINANCE_API_BASE_URL}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", BINANCE_KLINE_INTERVAL);
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
        next: { revalidate: KLINE_REVALIDATE_SECONDS },
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

function mergeAscendingKlines(
  existing: KlineCandle[],
  incoming: KlineCandle[],
): KlineCandle[] {
  const byOpenTime = new Map<number, KlineCandle>();
  for (const candle of existing) {
    byOpenTime.set(candle.openTime, candle);
  }
  for (const candle of incoming) {
    byOpenTime.set(candle.openTime, candle);
  }
  return [...byOpenTime.values()].sort((a, b) => a.openTime - b.openTime);
}

function filterKlinesInRange(params: {
  klines: KlineCandle[];
  startTime: number;
  endTime: number;
}): KlineCandle[] {
  return params.klines.filter(
    (candle) =>
      candle.openTime >= params.startTime && candle.openTime <= params.endTime,
  );
}

async function fetchKlinesRange(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  endTime: number;
}): Promise<KlineCandle[]> {
  const fetched: KlineCandle[] = [];
  let cursor = params.startTime;

  while (cursor <= params.endTime) {
    const page = await getKlines({
      symbol: params.symbol,
      interval: params.interval,
      limit: KLINE_PAGE_SIZE,
      startTime: cursor,
      endTime: params.endTime,
    });

    if (page.length === 0) {
      break;
    }

    fetched.push(...page);

    const lastOpenTime = page[page.length - 1]!.openTime;
    if (page.length < KLINE_PAGE_SIZE || lastOpenTime >= params.endTime) {
      break;
    }

    cursor = lastOpenTime + HOUR_MS;
  }

  return fetched;
}

async function prependMissingRange(params: {
  merged: KlineCandle[];
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  cappedEndTime: number;
}): Promise<KlineCandle[]> {
  const firstOpenTime = params.merged[0]?.openTime;
  if (params.merged.length > 0 && firstOpenTime !== undefined && firstOpenTime <= params.startTime) {
    return params.merged;
  }

  const prependEnd =
    firstOpenTime !== undefined ? firstOpenTime - HOUR_MS : params.cappedEndTime;
  if (prependEnd < params.startTime) {
    return params.merged;
  }

  const prepended = await fetchKlinesRange({
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    endTime: prependEnd,
  });
  return filterKlinesInRange({
    klines: mergeAscendingKlines(prepended, params.merged),
    startTime: params.startTime,
    endTime: params.cappedEndTime,
  });
}

async function appendMissingRange(params: {
  merged: KlineCandle[];
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  cappedEndTime: number;
}): Promise<KlineCandle[]> {
  const lastOpenTime = params.merged[params.merged.length - 1]?.openTime;
  if (params.merged.length > 0 && lastOpenTime !== undefined && lastOpenTime >= params.cappedEndTime) {
    return params.merged;
  }

  const appendStart = lastOpenTime !== undefined ? lastOpenTime + HOUR_MS : params.startTime;
  if (appendStart > params.cappedEndTime) {
    return params.merged;
  }

  const appended = await fetchKlinesRange({
    symbol: params.symbol,
    interval: params.interval,
    startTime: appendStart,
    endTime: params.cappedEndTime,
  });
  return filterKlinesInRange({
    klines: mergeAscendingKlines(params.merged, appended),
    startTime: params.startTime,
    endTime: params.cappedEndTime,
  });
}

async function hydrateHistoricalRange(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  cappedEndTime: number;
}): Promise<KlineCandle[]> {
  const reusable = await findReusableHistoricalKlinesCache({
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    endTime: params.cappedEndTime,
  });

  const fromCache = filterKlinesInRange({
    klines: reusable?.klines ?? [],
    startTime: params.startTime,
    endTime: params.cappedEndTime,
  });
  const withPrepended = await prependMissingRange({
    merged: fromCache,
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    cappedEndTime: params.cappedEndTime,
  });
  return appendMissingRange({
    merged: withPrepended,
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    cappedEndTime: params.cappedEndTime,
  });
}

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
  const cappedEndTime = Math.min(endTime, getLastClosedCandleOpenTime());
  if (cappedEndTime < startTime) {
    return [];
  }

  const merged = await hydrateHistoricalRange({
    symbol,
    interval,
    startTime,
    cappedEndTime,
  });

  if (merged.length > 0) {
    await writeHistoricalKlinesCache({
      symbol,
      interval,
      startTime,
      endTime: merged[merged.length - 1]!.openTime,
      klines: merged,
    });
  }

  return merged;
}
