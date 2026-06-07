import type { BacktestReport, EquityPoint, SimTrade } from "@/types/backtest";

interface BuildBacktestReportParams {
  startTime: number;
  endTime: number;
  initialCash: number;
  finalEquity: number;
  trades: SimTrade[];
  equityCurve: EquityPoint[];
}

/** Max equity fall while at least one position is open (excludes flat periods). */
function computeMaxDrawdownPct(equityCurve: EquityPoint[]): number {
  let exposurePeak = 0;
  let maxDrawdownPct = 0;

  for (const point of equityCurve) {
    if (point.openPositionCount === 0) {
      exposurePeak = 0;
      continue;
    }

    if (exposurePeak === 0) {
      exposurePeak = point.equity;
    } else if (point.equity > exposurePeak) {
      exposurePeak = point.equity;
    }

    if (exposurePeak > 0) {
      const drawdownPct = ((exposurePeak - point.equity) / exposurePeak) * 100;
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

  const openBuys = buildOpenBuyQueues(trades);

  let winningTrades = 0;
  let matchedSells = 0;

  for (const sell of sells) {
    const queue = openBuys.get(sell.symbol);
    const buy = queue?.shift();
    if (!buy) {
      continue;
    }
    matchedSells += 1;

    const buyCost = buy.notional + buy.fee;
    const sellProceeds = sell.notional - sell.fee;
    if (sellProceeds > buyCost) {
      winningTrades += 1;
    }
  }

  return {
    winRatePct: matchedSells > 0 ? (winningTrades / matchedSells) * 100 : 0,
    winningTrades,
    totalTrades: sells.length,
  };
}

function buildOpenBuyQueues(trades: SimTrade[]): Map<string, SimTrade[]> {
  const openBuys = new Map<string, SimTrade[]>();
  for (const trade of trades) {
    if (trade.side !== "BUY") {
      continue;
    }
    const queue = openBuys.get(trade.symbol) ?? [];
    queue.push(trade);
    openBuys.set(trade.symbol, queue);
  }
  return openBuys;
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
