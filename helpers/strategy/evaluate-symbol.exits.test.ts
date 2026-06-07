import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");
vi.mock("@/helpers/strategy/place-trade");
vi.mock("@/helpers/strategy/get-last-symbol-close-time");

import { getDb } from "@/db";
import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { placeTrade } from "@/helpers/strategy/place-trade";

import { evaluateSymbol } from "./evaluate-symbol";
import type { OpenPosition } from "./get-positions";

const mockedGetDb = vi.mocked(getDb);
const mockedGetKlines = vi.mocked(getRecentClosedKlines);
const mockedPlaceTrade = vi.mocked(placeTrade);

const HOUR_MS = 3_600_000;

function mockDbUpdate(): void {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  mockedGetDb.mockReturnValue({ update } as unknown as ReturnType<
    typeof getDb
  >);
}

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

function position(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    symbol: "TESTUSDT",
    qty: 10,
    buyPrice: 100,
    maxPriceAfterBuy: 100,
    buyTime: new Date(1000 * HOUR_MS),
    buyTradeId: 1,
    ...overrides,
  };
}

const BASE_PARAMS = {
  symbol: "TESTUSDT",
  interval: "H1" as const,
  cash: 10_000,
  lastProcessedOpenTime: null,
};

describe("evaluateSymbol exits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate();
    mockedPlaceTrade.mockResolvedValue(undefined);
  });

  it("holds when price increases less than 50%", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      149,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("holds when price increases exactly 50%", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("drawdown exit when price falls 25% from peak", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 2 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      200,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({
        buyTime: new Date(buyOpenTime),
        buyPrice: 100,
        maxPriceAfterBuy: 200,
      }),
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "exit_trailing_0.25_vs_peak",
      }),
    );
  });

  it("holds when price increases 50% after buy", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 3 * HOUR_MS;

    const candles = makeCandles(latestOpenTime, [
      150,
      120,
      110,
      ...Array(STRATEGY_LOOKBACK_CLOSES - 3).fill(90),
    ]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});
