import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { CandleInterval, KlineCandle } from "@/types/binance";

export interface HistoricalKlinesCachePayload {
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

function toSafeCacheToken(value: string): string {
  return value.replace(/[^A-Z0-9_-]/gi, "_");
}

function buildCacheFilePrefix(params: {
  symbol: string;
  interval: CandleInterval;
}): string {
  return `${toSafeCacheToken(params.symbol)}-${toSafeCacheToken(params.interval)}-`;
}

function buildCacheFilePath(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
}): string {
  const startDate = new Date(params.startTime).toISOString().slice(0, 10);
  return join(
    getCacheDirectory(),
    `${buildCacheFilePrefix(params)}${startDate}-${params.startTime}.json`,
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
  const filePath = buildCacheFilePath(params);
  const payload = await readCachePayloadFromFile(filePath, {
    symbol: params.symbol,
    interval: params.interval,
  });

  if (!payload || payload.startTime !== params.startTime) {
    return null;
  }

  return payload;
}

async function readCachePayloadFromFile(
  filePath: string,
  params: { symbol: string; interval: CandleInterval },
): Promise<HistoricalKlinesCachePayload | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isHistoricalKlinesCachePayload(parsed)) {
      return null;
    }

    if (
      parsed.symbol !== params.symbol ||
      parsed.interval !== params.interval
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

export async function listHistoricalKlinesCacheCandidates(params: {
  symbol: string;
  interval: CandleInterval;
}): Promise<HistoricalKlinesCachePayload[]> {
  const directory = getCacheDirectory();
  const prefix = buildCacheFilePrefix(params);
  let fileNames: string[];

  try {
    fileNames = await readdir(directory);
  } catch {
    return [];
  }

  const payloads: HistoricalKlinesCachePayload[] = [];
  for (const fileName of fileNames) {
    if (!fileName.startsWith(prefix) || !fileName.endsWith(".json")) {
      continue;
    }

    const payload = await readCachePayloadFromFile(join(directory, fileName), {
      symbol: params.symbol,
      interval: params.interval,
    });
    if (payload && payload.klines.length > 0) {
      payloads.push(payload);
    }
  }

  return payloads;
}

function scoreReusableCache(params: {
  payload: HistoricalKlinesCachePayload;
  startTime: number;
  endTime: number;
}): number {
  const { payload, startTime, endTime } = params;
  const firstOpenTime = payload.klines[0]!.openTime;
  const lastOpenTime = payload.klines[payload.klines.length - 1]!.openTime;
  const inRangeCount = payload.klines.filter(
    (candle) => candle.openTime >= startTime && candle.openTime <= endTime,
  ).length;

  let score = inRangeCount;
  if (lastOpenTime >= endTime) {
    score += 1_000_000;
  }
  if (firstOpenTime <= startTime) {
    score += 500_000;
  }

  return score;
}

export async function findReusableHistoricalKlinesCache(params: {
  symbol: string;
  interval: CandleInterval;
  startTime: number;
  endTime: number;
}): Promise<HistoricalKlinesCachePayload | null> {
  const exact = await readHistoricalKlinesCache({
    symbol: params.symbol,
    interval: params.interval,
    startTime: params.startTime,
  });
  if (exact && exact.klines.length > 0) {
    return exact;
  }

  const candidates = await listHistoricalKlinesCacheCandidates({
    symbol: params.symbol,
    interval: params.interval,
  });

  let best: HistoricalKlinesCachePayload | null = null;
  let bestScore = -1;

  for (const payload of candidates) {
    const score = scoreReusableCache({
      payload,
      startTime: params.startTime,
      endTime: params.endTime,
    });
    if (score > bestScore) {
      bestScore = score;
      best = payload;
    }
  }

  return bestScore > 0 ? best : null;
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
