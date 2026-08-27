import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import {
  createEvaluateOpenSymbol,
  mockDbUpdate,
} from "@/test/evaluate-symbol-fixtures";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");
vi.mock("@/helpers/strategy/place-trade");
vi.mock("@/helpers/strategy/get-last-symbol-close-time");

import { getDb } from "@/db";
import { getRecentClosedKlines } from "@/utils/binance/get-klines";
import { placeTrade } from "@/helpers/strategy/place-trade";

import { evaluateSymbol } from "./evaluate-symbol";

const mockedGetDb = vi.mocked(getDb);
const mockedGetKlines = vi.mocked(getRecentClosedKlines);
const mockedPlaceTrade = vi.mocked(placeTrade);

const LOOKBACK_BASE = Array(STRATEGY_LOOKBACK_CLOSES - 1).fill(100);
const LOOKBACK_BASE_MINUS_ONE = Array(STRATEGY_LOOKBACK_CLOSES - 2).fill(100);

const evaluateExit = createEvaluateOpenSymbol({
  evaluateSymbol,
  setKlines: (candles) => {
    mockedGetKlines.mockResolvedValue(candles);
  },
});

describe("evaluateSymbol exits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate(mockedGetDb);
    mockedPlaceTrade.mockResolvedValue(undefined);
  });

  it("holds when price increases less than 50%", async () => {
    const result = await evaluateExit({ specs: [149, ...LOOKBACK_BASE] });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("holds when price increases exactly 50%", async () => {
    const result = await evaluateExit({ specs: [150, ...LOOKBACK_BASE] });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("drawdown exit when price falls 25% from peak", async () => {
    const result = await evaluateExit({
      specs: [150, 200, ...LOOKBACK_BASE_MINUS_ONE],
      hoursAfterBuy: 2,
      positionOverrides: { maxPriceAfterBuy: 200 },
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
    const result = await evaluateExit({
      specs: [150, 120, 110, ...Array(STRATEGY_LOOKBACK_CLOSES - 3).fill(90)],
      hoursAfterBuy: 3,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});
