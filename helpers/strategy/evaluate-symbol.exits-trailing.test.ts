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

describe("evaluateSymbol exits trailing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate(mockedGetDb);
    mockedPlaceTrade.mockResolvedValue(undefined);
  });

  it("holds when price rises 90% then falls 10% from peak but still +50% vs buy", async () => {
    const result = await evaluateExit({
      specs: [161.5, 190, ...LOOKBACK_BASE_MINUS_ONE],
      hoursAfterBuy: 2,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("drawdown exit when price falls 25% from buy with no prior peak above buy", async () => {
    const result = await evaluateExit({ specs: [75, ...LOOKBACK_BASE] });

    expect(result.traded).toBe(true);
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        side: "SELL",
        reason: "exit_trailing_0.25_vs_peak",
      }),
    );
  });

  it("skips exit check when latest candle is before buy time", async () => {
    const result = await evaluateExit({
      specs: [50, ...LOOKBACK_BASE],
      hoursAfterBuy: -1,
    });

    expect(result.traded).toBe(false);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});
