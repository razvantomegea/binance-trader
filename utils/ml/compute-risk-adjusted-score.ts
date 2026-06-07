import { ML_DRAWDOWN_PENALTY } from "@/constants/ml-strategy";
import type { BacktestReport } from "@/types/backtest";
import type { MlRiskAdjustedMetrics } from "@/types/ml-strategy";

function computeRiskAdjustedScore(params: {
  pnlPct: number;
  maxDrawdownPct: number;
  drawdownPenalty?: number;
}): number {
  const penalty = params.drawdownPenalty ?? ML_DRAWDOWN_PENALTY;
  return params.pnlPct - penalty * params.maxDrawdownPct;
}

export function metricsFromBacktestReport(
  report: BacktestReport,
): MlRiskAdjustedMetrics {
  return {
    pnlPct: report.pnlPct,
    maxDrawdownPct: report.maxDrawdownPct,
    winRatePct: report.winRatePct,
    totalTrades: report.totalTrades,
    riskAdjustedScore: computeRiskAdjustedScore({
      pnlPct: report.pnlPct,
      maxDrawdownPct: report.maxDrawdownPct,
    }),
  };
}
