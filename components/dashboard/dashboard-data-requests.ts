import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import { computeNextStrategyCronRunIso } from "@/utils/scheduler/compute-next-cron-run";
import type {
  EquityCurveResponse,
  PortfolioResponse,
  TradesResponse,
} from "@/types/portfolio";

import type { StrategyStatus, SymbolRow } from "@/components/dashboard/types";

function ensureSelectedSymbol({
  rows,
  selectedSymbol,
  setSelectedSymbol,
}: {
  rows: SymbolRow[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
}): void {
  if (rows.length === 0 || rows.some((row) => row.symbol === selectedSymbol)) {
    return;
  }
  setSelectedSymbol(rows[0]!.symbol);
}

async function readSymbolRows(response: Response): Promise<SymbolRow[] | null> {
  if (!response.ok) {
    return null;
  }
  const { symbols } = (await response.json()) as { symbols: string[] };
  return symbols
    .filter((symbol) => isUsdtSymbol(symbol))
    .map((symbol) => ({ symbol, close: null }));
}

async function readPortfolio(
  response: Response,
): Promise<PortfolioResponse | null> {
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as PortfolioResponse;
}

async function readTrades(
  response: Response,
): Promise<TradesResponse["trades"] | null> {
  if (!response.ok) {
    return null;
  }
  const tradesJson = (await response.json()) as TradesResponse;
  return tradesJson.trades;
}

async function readSnapshots(
  response: Response,
): Promise<EquityCurveResponse["snapshots"] | null> {
  if (!response.ok) {
    return null;
  }
  const equityJson = (await response.json()) as EquityCurveResponse;
  return equityJson.snapshots;
}

async function readStrategyStatus({
  response,
  nowMs,
}: {
  response: Response;
  nowMs: number;
}): Promise<{ status: StrategyStatus | null; error: string | null }> {
  if (!response.ok) {
    const body = (await response.text()) || "unknown error";
    return {
      status: null,
      error: `Could not fetch strategy status (${response.status}): ${body}`,
    };
  }
  const status = (await response.json()) as StrategyStatus;
  return {
    status: {
      ...status,
      nextRunAt:
        status.nextRunAt ??
        (status.running ? computeNextStrategyCronRunIso(nowMs) : null),
    },
    error: null,
  };
}

export async function fetchAndReadDashboardData(): Promise<{
  rows: SymbolRow[] | null;
  portfolioData: PortfolioResponse | null;
  tradesData: TradesResponse["trades"] | null;
  snapshotsData: EquityCurveResponse["snapshots"] | null;
  strategyRead: { status: StrategyStatus | null; error: string | null };
}> {
  const responses = await Promise.all([
    fetch("/api/usdt-symbols"),
    fetch(`/api/portfolio?interval=${STRATEGY_INTERVAL}`),
    fetch("/api/trades?limit=50"),
    fetch(`/api/equity-curve?interval=${STRATEGY_INTERVAL}&limit=200`),
    fetch("/api/strategy/status"),
  ]);
  const [symbolsRes, portfolioRes, tradesRes, equityRes, strategyRes] = responses;
  const [rows, portfolioData, tradesData, snapshotsData, strategyRead] =
    await Promise.all([
      readSymbolRows(symbolsRes),
      readPortfolio(portfolioRes),
      readTrades(tradesRes),
      readSnapshots(equityRes),
      readStrategyStatus({ response: strategyRes, nowMs: Date.now() }),
    ]);
  return { rows, portfolioData, tradesData, snapshotsData, strategyRead };
}

export function applyRefreshData({
  rows,
  selectedSymbol,
  setSelectedSymbol,
  setSymbolRows,
  portfolioData,
  setPortfolio,
  tradesData,
  setTrades,
  snapshotsData,
  setSnapshots,
  strategyRead,
  setStrategyStatus,
  setStatusRequestError,
}: {
  rows: SymbolRow[] | null;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  setSymbolRows: (rows: SymbolRow[]) => void;
  portfolioData: PortfolioResponse | null;
  setPortfolio: (portfolio: PortfolioResponse) => void;
  tradesData: TradesResponse["trades"] | null;
  setTrades: (trades: TradesResponse["trades"]) => void;
  snapshotsData: EquityCurveResponse["snapshots"] | null;
  setSnapshots: (snapshots: EquityCurveResponse["snapshots"]) => void;
  strategyRead: { status: StrategyStatus | null; error: string | null };
  setStrategyStatus: (status: StrategyStatus | null) => void;
  setStatusRequestError: (error: string | null) => void;
}): void {
  if (rows) {
    setSymbolRows(rows);
    ensureSelectedSymbol({ rows, selectedSymbol, setSelectedSymbol });
  }
  if (portfolioData) {
    setPortfolio(portfolioData);
  }
  if (tradesData) {
    setTrades(tradesData);
  }
  if (snapshotsData) {
    setSnapshots(snapshotsData);
  }
  setStrategyStatus(strategyRead.status);
  setStatusRequestError(strategyRead.error);
}
