import { describe, expect, it } from "vitest";

import { ML_DRAWDOWN_PENALTY } from "@/constants/ml-strategy";
import type { BacktestReport } from "@/types/backtest";

import { metricsFromBacktestReport } from "./compute-risk-adjusted-score";

function makeReport(overrides: Partial<BacktestReport> = {}): BacktestReport {
  return {
    pnlPct: 10,
    maxDrawdownPct: 5,
    winRatePct: 55,
    totalTrades: 20,
    ...overrides,
  } as BacktestReport;
}

describe("metricsFromBacktestReport", () => {
  it("maps report fields and computes risk-adjusted score", () => {
    const report = makeReport({ pnlPct: 12, maxDrawdownPct: 4 });

    const metrics = metricsFromBacktestReport(report);

    expect(metrics).toEqual({
      pnlPct: 12,
      maxDrawdownPct: 4,
      winRatePct: 55,
      totalTrades: 20,
      riskAdjustedScore: 12 - ML_DRAWDOWN_PENALTY * 4,
    });
  });

  it("penalizes higher drawdown in risk-adjusted score", () => {
    const lowDrawdown = metricsFromBacktestReport(
      makeReport({ pnlPct: 10, maxDrawdownPct: 2 }),
    );
    const highDrawdown = metricsFromBacktestReport(
      makeReport({ pnlPct: 10, maxDrawdownPct: 8 }),
    );

    expect(lowDrawdown.riskAdjustedScore).toBeGreaterThan(
      highDrawdown.riskAdjustedScore,
    );
  });
});
