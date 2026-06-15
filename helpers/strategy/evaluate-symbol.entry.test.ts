import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");
vi.mock("@/helpers/strategy/place-trade");
vi.mock("@/helpers/strategy/get-last-symbol-close-time");

import { getLastSymbolCloseTime } from "@/helpers/strategy/get-last-symbol-close-time";
import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { placeTrade } from "@/helpers/strategy/place-trade";

import { evaluateSymbol } from "./evaluate-symbol";

const mockedGetKlines = vi.mocked(getRecentClosedKlines);
const mockedPlaceTrade = vi.mocked(placeTrade);
const mockedGetLastClose = vi.mocked(getLastSymbolCloseTime);

const HOUR_MS = 3_600_000;

function makeCandle(
  openTime: number,
  close: number,
  overrides: Partial<Pick<KlineCandle, "high" | "low" | "open">> = {},
): KlineCandle {
  return {
    openTime,
    open: overrides.open ?? close,
    high: overrides.high ?? close,
    low: overrides.low ?? close,
    close,
  };
}

function makeCandles(
  startOpenTime: number,
  specs: Array<number | { close: number; high?: number; low?: number }>,
): KlineCandle[] {
  return specs.map((spec, i) => {
    const openTime = startOpenTime - i * HOUR_MS;
    if (typeof spec === "number") {
      return makeCandle(openTime, spec);
    }
    return makeCandle(openTime, spec.close, {
      high: spec.high,
      low: spec.low,
    });
  });
}

const BASE_PARAMS = {
  symbol: "TESTUSDT",
  interval: "H1" as const,
  cash: 10_000,
  lastProcessedOpenTime: null,
};

describe("evaluateSymbol entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlaceTrade.mockResolvedValue(undefined);
    mockedGetLastClose.mockResolvedValue(null);
  });

  it("buys when close is within 40-60% band above lowest 24h close", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_band_0.5_0.75",
      }),
    );
  });

  it("does not buy when current is more than 10% below 24h high", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      { close: 152, high: 190, low: 100 },
      { close: 190, high: 190, low: 100 },
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when current is exactly 10% below 24h high", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      { close: 170, high: 200, low: 100 },
      { close: 200, high: 200, low: 100 },
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when 24h range is less than 40%", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      139,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when 24h range is more than 100%", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      { close: 190, high: 200, low: 90 },
      { close: 200, high: 200, low: 90 },
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when last SELL was within 24h even if entry qualifies", async () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const lastSellOpenTime =
      latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS + HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);
    mockedGetLastClose.mockResolvedValue(lastSellOpenTime);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("buys when last SELL was exactly 24h ago and entry qualifies", async () => {
    const latestOpenTime = 1000 * HOUR_MS;
    const lastSellOpenTime = latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);
    mockedGetLastClose.mockResolvedValue(lastSellOpenTime);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_band_0.5_0.75",
      }),
    );
  });
});
