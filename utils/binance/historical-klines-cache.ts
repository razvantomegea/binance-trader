import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CandleInterval, KlineCandle } from "@/types/binance";

interface HistoricalKlinesCachePayload {
  version: 1;
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  endTime: number;
  downloadedAtIso: string;
  klines: KlineCandle[];
}

function getCacheDirectory(): string {
  return join(process.cwd(), "backtest-cache", "binance-klines");
}

function buildCacheFilePath(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
}): string {
  const safeSymbol = params.symbol.replace(/[^A-Z0-9_-]/gi, "_");
  const safeInterval = params.interval.replace(/[^A-Z0-9_-]/gi, "_");
  const startDate = new Date(params.startTime).toISOString().slice(0, 10);
  return join(
    getCacheDirectory(),
    `${safeSymbol}-${safeInterval}-${startDate}-${params.startTime}.json`,
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isKlineCandle(value: unknown): value is KlineCandle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<KlineCandle>;
  return (
    isFiniteNumber(maybe.openTime) &&
    isFiniteNumber(maybe.open) &&
    isFiniteNumber(maybe.high) &&
    isFiniteNumber(maybe.low) &&
    isFiniteNumber(maybe.close)
  );
}

function normalizeAscendingUniqueKlines(klines: KlineCandle[]): KlineCandle[] {
  const byOpenTime = new Map<number, KlineCandle>();
  for (const candle of klines) {
    byOpenTime.set(candle.openTime, candle);
  }

  return [...byOpenTime.values()].sort((a, b) => a.openTime - b.openTime);
}

function isHistoricalKlinesCachePayload(
  value: unknown,
): value is HistoricalKlinesCachePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybe = value as Partial<HistoricalKlinesCachePayload>;
  return (
    maybe.version === 1 &&
    typeof maybe.symbol === "string" &&
    typeof maybe.interval === "string" &&
    isFiniteNumber(maybe.startTime) &&
    isFiniteNumber(maybe.endTime) &&
    typeof maybe.downloadedAtIso === "string" &&
    Array.isArray(maybe.klines) &&
    maybe.klines.every(isKlineCandle)
  );
}

export async function readHistoricalKlinesCache(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
}): Promise<HistoricalKlinesCachePayload | null> {
  try {
    const filePath = buildCacheFilePath(params);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isHistoricalKlinesCachePayload(parsed)) {
      return null;
    }

    if (
      parsed.symbol !== params.symbol ||
      parsed.interval !== params.interval ||
      parsed.startTime !== params.startTime
    ) {
      return null;
    }

    return {
      ...parsed,
      klines: normalizeAscendingUniqueKlines(parsed.klines),
    };
  } catch {
    return null;
  }
}

export async function writeHistoricalKlinesCache(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  endTime: number;
  klines: KlineCandle[];
}): Promise<void> {
  const filePath = buildCacheFilePath({
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
  });
  const directory = getCacheDirectory();
  await mkdir(directory, { recursive: true });

  const normalized = normalizeAscendingUniqueKlines(params.klines);
  const payload: HistoricalKlinesCachePayload = {
    version: 1,
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
    endTime: params.endTime,
    downloadedAtIso: new Date().toISOString(),
    klines: normalized,
  };

  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(payload), "utf8");
  await rename(tmpPath, filePath);
}
