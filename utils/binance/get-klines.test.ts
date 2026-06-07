import { beforeEach, describe, expect, it, vi } from "vitest";

import { HOUR_MS } from "@/utils/binance/candle-time";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/utils/binance/fetch-with-retry");
vi.mock("@/utils/binance/historical-klines-cache");

import { fetchWithRetry } from "@/utils/binance/fetch-with-retry";
import {
  findReusableHistoricalKlinesCache,
  writeHistoricalKlinesCache,
} from "@/utils/binance/historical-klines-cache";

import {
  getHistoricalClosedKlines,
  getKlines,
  getLatestClosedKline,
  getRecentClosedKlines,
} from "./get-klines";

const mockedFetchWithRetry = vi.mocked(fetchWithRetry);
const mockedFindCache = vi.mocked(findReusableHistoricalKlinesCache);
const mockedWriteCache = vi.mocked(writeHistoricalKlinesCache);

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

function binanceKline(openTime: number, close: number) {
  return [openTime, String(close), String(close), String(close), String(close)];
}

function okKlinesResponse(klines: unknown[]) {
  return new Response(JSON.stringify(klines), { status: 200 });
}

describe("getKlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWriteCache.mockResolvedValue(undefined);
    mockedFindCache.mockResolvedValue(null);
  });

  it("uses cached fetch path when no time bounds", async () => {
    mockFetch.mockResolvedValueOnce(
      okKlinesResponse([binanceKline(1000, 10), binanceKline(2000, 20)]),
    );

    const result = await getKlines({ symbol: "BTCUSDT", interval: "H1" });

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockedFetchWithRetry).not.toHaveBeenCalled();
    expect(result).toEqual([
      { openTime: 1000, open: 10, high: 10, low: 10, close: 10 },
      { openTime: 2000, open: 20, high: 20, low: 20, close: 20 },
    ]);
  });

  it("uses fetchWithRetry when startTime is set", async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      okKlinesResponse([binanceKline(3000, 30)]),
    );

    const result = await getKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 3000,
    });

    expect(mockedFetchWithRetry).toHaveBeenCalledOnce();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result[0]?.close).toBe(30);
  });

  it("uses fetchWithRetry when endTime is set", async () => {
    mockedFetchWithRetry.mockResolvedValueOnce(
      okKlinesResponse([binanceKline(4000, 40)]),
    );

    const result = await getKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      endTime: 5000,
    });

    expect(mockedFetchWithRetry).toHaveBeenCalledOnce();
    expect(result[0]?.close).toBe(40);
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("bad", { status: 400 }));

    await expect(
      getKlines({ symbol: "BTCUSDT", interval: "H1" }),
    ).rejects.toThrow(/Binance \/klines failed/);
  });

  it("includes response body in error message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("rate limited", { status: 429, statusText: "Too Many" }),
    );

    await expect(
      getKlines({ symbol: "BTCUSDT", interval: "H1" }),
    ).rejects.toThrow(/rate limited/);
  });

  it("throws on invalid payload", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([{ bad: true }]), { status: 200 }),
    );

    await expect(
      getKlines({ symbol: "BTCUSDT", interval: "H1" }),
    ).rejects.toThrow(/invalid payload/);
  });
});

describe("getRecentClosedKlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes forming candle and returns most recent closed first", async () => {
    mockFetch.mockResolvedValueOnce(
      okKlinesResponse([
        binanceKline(1000, 10),
        binanceKline(2000, 20),
        binanceKline(3000, 30),
      ]),
    );

    const result = await getRecentClosedKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      count: 2,
    });

    expect(result.map((c) => c.openTime)).toEqual([2000, 1000]);
  });

  it("returns empty array when no klines", async () => {
    mockFetch.mockResolvedValueOnce(okKlinesResponse([]));

    await expect(
      getRecentClosedKlines({
        symbol: "BTCUSDT",
        interval: "H1",
        count: 1,
      }),
    ).resolves.toEqual([]);
  });
});

describe("getLatestClosedKline", () => {
  it("returns first recent closed candle or null", async () => {
    mockFetch.mockResolvedValueOnce(
      okKlinesResponse([binanceKline(1000, 10), binanceKline(2000, 20)]),
    );

    await expect(
      getLatestClosedKline({ symbol: "BTCUSDT", interval: "H1" }),
    ).resolves.toEqual({
      openTime: 1000,
      open: 10,
      high: 10,
      low: 10,
      close: 10,
    });
  });
});

describe("getHistoricalClosedKlines", () => {
  const cachedKlines: KlineCandle[] = Array.from({ length: 30 }, (_, i) => ({
    openTime: i * HOUR_MS,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockedWriteCache.mockResolvedValue(undefined);
    mockedFindCache.mockResolvedValue({
      version: 1,
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 0,
      endTime: 29 * HOUR_MS,
      downloadedAtIso: new Date().toISOString(),
      klines: cachedKlines,
    });
  });

  it("hydrates from cache and writes updated cache", async () => {
    const result = await getHistoricalClosedKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 0,
      endTime: 29 * HOUR_MS,
    });

    expect(result.length).toBeGreaterThan(0);
    expect(mockedFindCache).toHaveBeenCalled();
    expect(mockedWriteCache).toHaveBeenCalled();
  });

  it("returns empty when capped end is before start", async () => {
    vi.spyOn(Date, "now").mockReturnValue(0);

    const result = await getHistoricalClosedKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: HOUR_MS,
      endTime: 0,
    });

    expect(result).toEqual([]);
    vi.restoreAllMocks();
  });

  it("fetches missing prepend and append ranges from cache gaps", async () => {
    mockedFindCache.mockResolvedValue({
      version: 1,
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 5 * HOUR_MS,
      endTime: 10 * HOUR_MS,
      downloadedAtIso: new Date().toISOString(),
      klines: Array.from({ length: 6 }, (_, i) => ({
        openTime: (5 + i) * HOUR_MS,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
      })),
    });
    mockedFetchWithRetry.mockImplementation(async () =>
      okKlinesResponse([
        binanceKline(0, 1),
        binanceKline(HOUR_MS, 2),
        binanceKline(11 * HOUR_MS, 3),
        binanceKline(12 * HOUR_MS, 4),
      ]),
    );

    const result = await getHistoricalClosedKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 0,
      endTime: 12 * HOUR_MS,
    });

    expect(result.length).toBeGreaterThan(6);
    expect(mockedFetchWithRetry).toHaveBeenCalled();
  });

  it("skips cache write when no klines returned", async () => {
    mockedFindCache.mockResolvedValue(null);
    mockedFetchWithRetry.mockImplementation(async () => okKlinesResponse([]));

    const result = await getHistoricalClosedKlines({
      symbol: "BTCUSDT",
      interval: "H1",
      startTime: 0,
      endTime: 5 * HOUR_MS,
    });

    expect(result).toEqual([]);
    expect(mockedWriteCache).not.toHaveBeenCalled();
  });
});
