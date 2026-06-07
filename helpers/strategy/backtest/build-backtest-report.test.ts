import { describe, expect, it } from "vitest";

import { NULL_TRADE_POST_CLOSE_24H } from "@/types/trade-metrics";
import { HOUR_MS } from "@/utils/binance/candle-time";

import { buildBacktestReport } from "./build-backtest-report";

describe("buildBacktestReport", () => {
  it("returns zero win rate when no sells", () => {
    const report = buildBacktestReport({
      startTime: 0,
      endTime: HOUR_MS,
      initialCash: 10000,
      finalEquity: 10000,
      trades: [
        {
          symbol: "BTCUSDT",
          side: "BUY",
          qty: 1,
          price: 100,
          notional: 100,
          fee: 0,
          candleOpenTime: HOUR_MS,
          reason: "entry",
          openPrice: 100,
          closePrice: null,
          maxPriceAfterBuy: 100,
          realizedPnlPct: null,
          ...NULL_TRADE_POST_CLOSE_24H,
        },
      ],
      equityCurve: [
        { openTime: 0, cash: 10000, equity: 10000, openPositionCount: 0 },
        {
          openTime: HOUR_MS,
          cash: 9900,
          equity: 10000,
          openPositionCount: 1,
        },
      ],
    });

    expect(report.winRatePct).toBe(0);
    expect(report.totalTrades).toBe(0);
    expect(report.pnlPct).toBe(0);
  });

  it("computes losing win rate and exposure drawdown", () => {
    const report = buildBacktestReport({
      startTime: 0,
      endTime: 3 * HOUR_MS,
      initialCash: 10000,
      finalEquity: 9500,
      trades: [
        {
          symbol: "A",
          side: "BUY",
          qty: 1,
          price: 100,
          notional: 100,
          fee: 1,
          candleOpenTime: HOUR_MS,
          reason: "entry",
          openPrice: 100,
          closePrice: null,
          maxPriceAfterBuy: 100,
          realizedPnlPct: null,
          ...NULL_TRADE_POST_CLOSE_24H,
        },
        {
          symbol: "A",
          side: "SELL",
          qty: 1,
          price: 90,
          notional: 90,
          fee: 1,
          candleOpenTime: 2 * HOUR_MS,
          reason: "exit",
          openPrice: 100,
          closePrice: 90,
          maxPriceAfterBuy: 100,
          realizedPnlPct: -10,
          ...NULL_TRADE_POST_CLOSE_24H,
        },
      ],
      equityCurve: [
        { openTime: 0, cash: 10000, equity: 10000, openPositionCount: 0 },
        {
          openTime: HOUR_MS,
          cash: 9899,
          equity: 9999,
          openPositionCount: 1,
        },
        {
          openTime: 2 * HOUR_MS,
          cash: 9988,
          equity: 9000,
          openPositionCount: 1,
        },
        {
          openTime: 3 * HOUR_MS,
          cash: 9500,
          equity: 9500,
          openPositionCount: 0,
        },
      ],
    });

    expect(report.pnlPct).toBeCloseTo(-5);
    expect(report.winRatePct).toBe(0);
    expect(report.maxDrawdownPct).toBeGreaterThan(0);
  });

  it("handles zero initial cash without NaN pnl", () => {
    const report = buildBacktestReport({
      startTime: 0,
      endTime: 0,
      initialCash: 0,
      finalEquity: 0,
      trades: [],
      equityCurve: [],
    });

    expect(report.pnlPct).toBe(0);
  });
});
