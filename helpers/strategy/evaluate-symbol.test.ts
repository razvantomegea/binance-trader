import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

import { evaluateSymbol } from "./evaluate-symbol";
import type { OpenPosition } from "./get-positions";

vi.mock("@/utils/binance/get-klines");
vi.mock("@/helpers/strategy/place-trade");

import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { placeTrade } from "@/helpers/strategy/place-trade";

const mockedGetKlines = vi.mocked(getRecentClosedKlines);
const mockedPlaceTrade = vi.mocked(placeTrade);

const HOUR_MS = 3_600_000;

function makeCandle(openTime: number, close: number): KlineCandle {
  return { openTime, open: close, high: close, low: close, close };
}

function makeCandles(
  startOpenTime: number,
  closes: number[],
): KlineCandle[] {
  return closes.map((c, i) => makeCandle(startOpenTime - i * HOUR_MS, c));
}

function position(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    symbol: "TESTUSDT",
    qty: 10,
    buyPrice: 100,
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
    mockedPlaceTrade.mockResolvedValue(undefined);
  });

  it("no TP when price increases less than 50%", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;

    const closes = [149, ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("TP when price increases exactly 50%", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + HOUR_MS;

    const closes = [150, ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "take_profit_50pct_vs_24h_or_buy",
      }),
    );
  });

  it("SL when price rises 100% then falls 15% from buy", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 2 * HOUR_MS;

    const closes = [85, 200, ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "stop_loss_15pct_vs_24h_or_buy",
      }),
    );
  });

  it("TP when price increases 50% after buy", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 3 * HOUR_MS;

    const closes = [150, 120, 110, ...Array(STRATEGY_LOOKBACK_CLOSES - 3).fill(90)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "take_profit_50pct_vs_24h_or_buy",
      }),
    );
  });

  it("no SL when price rises 90% then falls 15% from peak (still above buy)", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime + 2 * HOUR_MS;

    // 190 peak, 161.5 is -15% from peak but +61.5% vs buy => TP, not SL
    const closes = [161.5, 190, ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "take_profit_50pct_vs_24h_or_buy",
      }),
    );
  });

  it("skips exit check when latest candle is before buy time", async () => {
    const buyOpenTime = 1000 * HOUR_MS;
    const latestOpenTime = buyOpenTime - HOUR_MS;

    const closes = [50, ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: position({ buyTime: new Date(buyOpenTime), buyPrice: 100 }),
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});

describe("evaluateSymbol entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlaceTrade.mockResolvedValue(undefined);
  });

  it("buys when pump >= 50% vs prior closes", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const closes = [150, ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_pump_50pct_vs_prior_23h",
      }),
    );
  });

  it("buys after 90% pump then 20% fall (still +52% vs prior)", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    // Prior candles show pump to 190 then current close fell 20% to 152
    const closes = [152, 190, ...Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_pump_50pct_vs_prior_23h",
      }),
    );
  });

  it("does not buy when pump < 50%", async () => {
    const latestOpenTime = 1000 * HOUR_MS;

    const closes = [149, ...Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100)];
    const candles = makeCandles(latestOpenTime, closes as number[]);
    mockedGetKlines.mockResolvedValue(candles);

    const result = await evaluateSymbol({
      ...BASE_PARAMS,
      position: undefined,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});
