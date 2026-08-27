import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STRATEGY_LOOKBACK_CLOSES,
  SYMBOL_REENTRY_COOLDOWN_MS,
} from "@/constants/strategy";
import { type CandleSpec, makeKlineCandles } from "@/test/candle-fixtures";
import { EVALUATE_SYMBOL_BASE_PARAMS } from "@/test/evaluate-symbol-fixtures";
import { HOUR_MS } from "@/utils/binance/candle-time";

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

const LOOKBACK_BASE = Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100);
const LOOKBACK_BASE_MINUS_ONE = Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100);

async function evaluateEntry(specs: CandleSpec[]) {
  const latestOpenTime = 1000 * HOUR_MS;
  mockedGetKlines.mockResolvedValue(makeKlineCandles(latestOpenTime, specs));
  return evaluateSymbol({
    ...EVALUATE_SYMBOL_BASE_PARAMS,
    position: undefined,
  });
}

describe("evaluateSymbol entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlaceTrade.mockResolvedValue(undefined);
    mockedGetLastClose.mockResolvedValue(null);
  });

  it("buys when close is within 25-50% band above lowest 24h close", async () => {
    const result = await evaluateEntry([150, ...LOOKBACK_BASE]);

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_band_0.25_0.5",
      }),
    );
  });

  it("does not buy when current is more than 10% below 24h high", async () => {
    const result = await evaluateEntry([
      { close: 152, high: 190, low: 100 },
      { close: 190, high: 190, low: 100 },
      ...LOOKBACK_BASE_MINUS_ONE,
    ]);

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when current is exactly 10% below 24h high", async () => {
    const result = await evaluateEntry([
      { close: 170, high: 200, low: 100 },
      { close: 200, high: 200, low: 100 },
      ...LOOKBACK_BASE_MINUS_ONE,
    ]);

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when 24h range is less than 25%", async () => {
    const result = await evaluateEntry([124, ...LOOKBACK_BASE]);

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when 24h range is more than 100%", async () => {
    const result = await evaluateEntry([
      { close: 190, high: 200, low: 90 },
      { close: 200, high: 200, low: 90 },
      ...LOOKBACK_BASE_MINUS_ONE,
    ]);

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("does not buy when last SELL was within 24h even if entry qualifies", async () => {
    const latestOpenTime = 1000 * HOUR_MS;
    mockedGetLastClose.mockResolvedValue(
      latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS + HOUR_MS,
    );

    const result = await evaluateEntry([150, ...LOOKBACK_BASE]);

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("buys when last SELL was exactly 24h ago and entry qualifies", async () => {
    const latestOpenTime = 1000 * HOUR_MS;
    mockedGetLastClose.mockResolvedValue(
      latestOpenTime - SYMBOL_REENTRY_COOLDOWN_MS,
    );

    const result = await evaluateEntry([150, ...LOOKBACK_BASE]);

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "BUY",
        reason: "entry_band_0.25_0.5",
      }),
    );
  });
});
