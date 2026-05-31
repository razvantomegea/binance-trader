import type { BacktestReport, EquityPoint, SimTrade } from "@/types/backtest";

interface BuildBacktestReportParams {
  startTime: number;
  endTime: number;
  initialCash: number;
  finalEquity: number;
  trades: SimTrade[];
  equityCurve: EquityPoint[];
}

function computeMaxDrawdownPct(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) {
    return 0;
  }

  let peak = equityCurve[0]!.equity;
  let maxDrawdownPct = 0;

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
    }

    if (peak > 0) {
      const drawdownPct = ((peak - point.equity) / peak) * 100;
      if (drawdownPct > maxDrawdownPct) {
        maxDrawdownPct = drawdownPct;
      }
    }
  }

  return maxDrawdownPct;
}

function computeWinRatePct(trades: SimTrade[]): {
  winRatePct: number;
  winningTrades: number;
  totalTrades: number;
} {
  const sells = trades.filter((trade) => trade.side === "SELL");
  if (sells.length === 0) {
    return { winRatePct: 0, winningTrades: 0, totalTrades: 0 };
  }

  const openBuys = new Map<string, SimTrade[]>();

  for (const trade of trades) {
    if (trade.side === "BUY") {
      const queue = openBuys.get(trade.symbol) ?? [];
      queue.push(trade);
      openBuys.set(trade.symbol, queue);
    }
  }

  let winningTrades = 0;

  for (const sell of sells) {
    const queue = openBuys.get(sell.symbol);
    const buy = queue?.shift();
    if (!buy) {
      continue;
    }

    const buyCost = buy.notional + buy.fee;
    const sellProceeds = sell.notional - sell.fee;
    if (sellProceeds > buyCost) {
      winningTrades += 1;
    }
  }

  return {
    winRatePct: (winningTrades / sells.length) * 100,
    winningTrades,
    totalTrades: sells.length,
  };
}

export function buildBacktestReport(
  params: BuildBacktestReportParams,
): BacktestReport {
  const pnlPct =
    params.initialCash > 0
      ? ((params.finalEquity - params.initialCash) / params.initialCash) * 100
      : 0;

  const { winRatePct, winningTrades, totalTrades } = computeWinRatePct(
    params.trades,
  );

  return {
    startTime: params.startTime,
    endTime: params.endTime,
    initialCash: params.initialCash,
    finalEquity: params.finalEquity,
    pnlPct,
    maxDrawdownPct: computeMaxDrawdownPct(params.equityCurve),
    winRatePct,
    totalTrades,
    winningTrades,
    trades: params.trades,
    equityCurve: params.equityCurve,
  };
}
