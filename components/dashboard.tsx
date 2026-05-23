"use client";

import { useCallback, useEffect, useState } from "react";

import { EquityCurve } from "@/components/equity-curve";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { PositionsTable } from "@/components/positions-table";
import { PriceChart } from "@/components/price-chart";
import { SymbolList } from "@/components/symbol-list";
import { TradesTable } from "@/components/trades-table";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type {
  EquityCurveResponse,
  PortfolioResponse,
  TradesResponse,
} from "@/types/portfolio";

const POLL_MS = 30_000;
const DEFAULT_SYMBOL = "BTCUSDT";

interface SymbolRow {
  symbol: string;
  close: string | null;
}

interface StrategyStatus {
  running: boolean;
  runningNow: boolean;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
}

export function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [symbolRows, setSymbolRows] = useState<SymbolRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [trades, setTrades] = useState<TradesResponse["trades"]>([]);
  const [snapshots, setSnapshots] = useState<EquityCurveResponse["snapshots"]>(
    [],
  );
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [strategyStatus, setStrategyStatus] = useState<StrategyStatus | null>(
    null,
  );
  const [strategyActionPending, setStrategyActionPending] = useState(false);

  const refresh = useCallback(async () => {
    setLoadingPortfolio(true);

    try {
      const [symbolsRes, portfolioRes, tradesRes, equityRes, strategyRes] =
        await Promise.all([
          fetch("/api/usdt-symbols"),
          fetch(`/api/portfolio?interval=${STRATEGY_INTERVAL}`),
          fetch("/api/trades?limit=50"),
          fetch(`/api/equity-curve?interval=${STRATEGY_INTERVAL}&limit=200`),
          fetch("/api/strategy/status"),
        ]);

      if (symbolsRes.ok) {
        const { symbols } = (await symbolsRes.json()) as { symbols: string[] };
        const rows: SymbolRow[] = symbols.map((symbol) => ({
          symbol,
          close: null,
        }));
        setSymbolRows(rows);

        if (rows.length > 0 && !rows.some((row) => row.symbol === selectedSymbol)) {
          setSelectedSymbol(rows[0]!.symbol);
        }
      }

      if (portfolioRes.ok) {
        setPortfolio((await portfolioRes.json()) as PortfolioResponse);
      }

      if (tradesRes.ok) {
        const tradesJson = (await tradesRes.json()) as TradesResponse;
        setTrades(tradesJson.trades);
      }

      if (equityRes.ok) {
        const equityJson = (await equityRes.json()) as EquityCurveResponse;
        setSnapshots(equityJson.snapshots);
      }

      if (strategyRes.ok) {
        setStrategyStatus((await strategyRes.json()) as StrategyStatus);
      }
    } finally {
      setLoadingSymbols(false);
      setLoadingPortfolio(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (!cancelled) {
        void refresh();
      }
    };

    const timer = window.setInterval(tick, POLL_MS);
    const initial = window.setTimeout(tick, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const toggleStrategy = async () => {
    setStrategyActionPending(true);
    try {
      const action = strategyStatus?.running ? "stop" : "start";
      await fetch(`/api/strategy/${action}`, { method: "POST" });
      await refresh();
    } finally {
      setStrategyActionPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Binance Trading Dashboard</h1>
            <p className="text-sm text-zinc-500">
              Hourly paper strategy: last close vs prior 23 hourly closes (+50%
              buy, -15% / +50% sell)
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PushNotificationToggle />
            <button
              type="button"
              onClick={() => void toggleStrategy()}
              disabled={strategyActionPending}
              className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                strategyStatus?.running
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {strategyActionPending
                ? "Please wait..."
                : strategyStatus?.running
                  ? "Stop strategy"
                  : "Start strategy"}
            </button>
          </div>
        </div>
        <div className="mx-auto mt-2 max-w-7xl text-xs text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span>
              Status:{" "}
              {strategyStatus?.runningNow
                ? "Running now"
                : strategyStatus?.running
                  ? "Started"
                  : "Stopped"}
            </span>
            {strategyStatus?.nextRunAt ? (
              <span>
                Next run: {new Date(strategyStatus.nextRunAt).toLocaleString()}
              </span>
            ) : null}
            {strategyStatus?.lastRunAt ? (
              <span>
                Last run: {new Date(strategyStatus.lastRunAt).toLocaleString()}
              </span>
            ) : null}
            {strategyStatus?.lastError ? (
              <span className="text-rose-500">
                Last error: {strategyStatus.lastError}
              </span>
            ) : null}
          </span>
        </div>
        <div className="mx-auto mt-4 max-w-7xl">
          <PortfolioSummary
            portfolio={portfolio}
            loading={loadingPortfolio}
          />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr]">
        <div className="h-[calc(100vh-12rem)] min-h-[320px]">
          <SymbolList
            symbols={symbolRows}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
            loading={loadingSymbols}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-medium text-zinc-500">
              {selectedSymbol} · H1
            </h2>
            <PriceChart symbol={selectedSymbol} interval={STRATEGY_INTERVAL} />
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-3 text-sm font-medium text-zinc-500">
              Strategy equity (hourly)
            </h2>
            <EquityCurve snapshots={snapshots} loading={loadingPortfolio} />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">
                Open positions
              </h2>
              <PositionsTable positions={portfolio?.positions ?? []} />
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-3 text-sm font-medium text-zinc-500">
                Recent trades
              </h2>
              <TradesTable trades={trades} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
