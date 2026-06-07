import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_PAPER_CASH } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";

vi.mock("@/utils/binance/get-usdt-symbols");
vi.mock("@/helpers/strategy/evaluate-symbol");
vi.mock("@/helpers/strategy/get-cash");
vi.mock("@/helpers/strategy/get-last-candle-time");
vi.mock("@/helpers/strategy/get-positions");
vi.mock("@/helpers/strategy/enforce-portfolio-drawdown-cap");
vi.mock("@/helpers/strategy/snapshot-equity");
vi.mock("@/helpers/trades/backfill-max-price-after-buy");
vi.mock("@/helpers/trades/backfill-post-close-24h");

import { enforcePortfolioDrawdownCap } from "@/helpers/strategy/enforce-portfolio-drawdown-cap";
import { evaluateSymbol } from "@/helpers/strategy/evaluate-symbol";
import { getCash } from "@/helpers/strategy/get-cash";
import {
  getLastCandleTime,
  setLastCandleTime,
} from "@/helpers/strategy/get-last-candle-time";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { snapshotEquity } from "@/helpers/strategy/snapshot-equity";
import { backfillMaxPriceAfterBuy } from "@/helpers/trades/backfill-max-price-after-buy";
import { backfillPostClose24hMetrics } from "@/helpers/trades/backfill-post-close-24h";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";

import { runStrategy } from "./strategy-runner";

const mockedGetUsdtSymbols = vi.mocked(getUsdtSymbols);
const mockedEvaluateSymbol = vi.mocked(evaluateSymbol);
const mockedGetCash = vi.mocked(getCash);
const mockedGetLastCandleTime = vi.mocked(getLastCandleTime);
const mockedSetLastCandleTime = vi.mocked(setLastCandleTime);
const mockedGetOpenPositions = vi.mocked(getOpenPositions);
const mockedEnforceDrawdown = vi.mocked(enforcePortfolioDrawdownCap);
const mockedSnapshotEquity = vi.mocked(snapshotEquity);
const mockedBackfillPostClose = vi.mocked(backfillPostClose24hMetrics);
const mockedBackfillMaxPrice = vi.mocked(backfillMaxPriceAfterBuy);

describe("runStrategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetUsdtSymbols.mockResolvedValue(["BTCUSDT", "ETHUSDT"]);
    mockedGetLastCandleTime.mockResolvedValue(null);
    mockedGetOpenPositions.mockResolvedValue(new Map());
    mockedGetCash.mockResolvedValue(INITIAL_PAPER_CASH);
    mockedEvaluateSymbol.mockResolvedValue({
      traded: false,
      candleOpenTime: 1000,
    });
    mockedSetLastCandleTime.mockResolvedValue(undefined);
    mockedEnforceDrawdown.mockResolvedValue({ liquidated: 0 });
    mockedSnapshotEquity.mockResolvedValue({
      cash: INITIAL_PAPER_CASH,
      equity: INITIAL_PAPER_CASH,
    });
    mockedBackfillPostClose.mockResolvedValue({
      scanned: 1,
      updated: 0,
      skipped: 1,
    });
    mockedBackfillMaxPrice.mockResolvedValue({
      scanned: 1,
      updated: 0,
      skipped: 1,
    });
  });

  it("throws when no valid symbols", async () => {
    mockedGetUsdtSymbols.mockResolvedValue([]);

    await expect(runStrategy()).rejects.toThrow(/No valid USDT symbols/);
  });

  it("evaluates symbols and returns summary", async () => {
    mockedEvaluateSymbol
      .mockResolvedValueOnce({ traded: true, candleOpenTime: 2000 })
      .mockResolvedValueOnce({ traded: false, candleOpenTime: 3000 });

    const result = await runStrategy();

    expect(result.interval).toBe(STRATEGY_INTERVAL);
    expect(result.symbolsEvaluated).toBe(2);
    expect(result.tradesExecuted).toBe(1);
    expect(mockedSetLastCandleTime).toHaveBeenCalledWith({
      interval: STRATEGY_INTERVAL,
      openTime: 3000,
    });
    expect(mockedEnforceDrawdown).toHaveBeenCalled();
    expect(result.postClose24hBackfill.scanned).toBe(1);
  });

  it("uses backfill fallbacks on failure", async () => {
    mockedBackfillPostClose.mockRejectedValueOnce(new Error("backfill down"));
    mockedBackfillMaxPrice.mockRejectedValueOnce(new Error("backfill down"));

    const result = await runStrategy();

    expect(result.postClose24hBackfill).toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
    });
    expect(result.maxPriceAfterBuyBackfill).toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
    });
  });
});
