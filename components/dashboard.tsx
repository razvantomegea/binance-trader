"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME } from "@/constants/dashboard-layout";
import { EquityCurve } from "@/components/equity-curve";
import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { PositionsTable } from "@/components/positions-table";
import { PriceChart } from "@/components/price-chart";
import { SymbolList } from "@/components/symbol-list";
import { TradesTable } from "@/components/trades-table";
import {
  BREAK_EVEN_LOCK_TRIGGER_PCT,
  BUY_NOTIONAL_PCT,
  ENTRY_MAX_RANGE_PCT,
  ENTRY_PULLBACK_PCT,
  ENTRY_RANGE_PCT,
  EXIT_DRAWDOWN_PCT,
  TAKE_PROFIT_PCT,
} from "@/constants/binance";
import {
  STRATEGY_CRON_NO_RUN_AFTER_START_MS,
  STRATEGY_CRON_STALE_MS,
} from "@/constants/cron";
import { STRATEGY_INTERVAL, STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import { useDashboardHeaderHeight } from "@/hooks/use-dashboard-header-height";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import { computeNextStrategyCronRunIso } from "@/utils/scheduler/compute-next-cron-run";
import type {
  EquityCurveResponse,
  PortfolioResponse,
  TradesResponse,
} from "@/types/portfolio";

const POLL_MS = 30_000;
const DEFAULT_SYMBOL = "BTCUSDT";
const STRATEGY_PRIOR_CLOSES = STRATEGY_LOOKBACK_CLOSES - 1;

function formatPct(value: number): string {
  return `${(value * 100).toFixed(Number.isInteger(value * 100) ? 0 : 1)}%`;
}

const STRATEGY_DESCRIPTION = [
  `${STRATEGY_INTERVAL} paper strategy`,
  `last close vs prior ${STRATEGY_PRIOR_CLOSES} closes`,
  `entry: 24h range ${formatPct(ENTRY_RANGE_PCT)}-${formatPct(ENTRY_MAX_RANGE_PCT)} and within ${formatPct(ENTRY_PULLBACK_PCT)} of 24h high`,
  `size: ${formatPct(BUY_NOTIONAL_PCT)} cash`,
  `exit: trailing ${formatPct(EXIT_DRAWDOWN_PCT)} / TP ${formatPct(TAKE_PROFIT_PCT)} / break-even lock at +${formatPct(BREAK_EVEN_LOCK_TRIGGER_PCT)}`,
].join(" | ");

interface SymbolRow {
  symbol: string;
  close: string | null;
}

interface StrategyStatus {
  running: boolean;
  runningNow: boolean;
  heartbeatMs: number;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
}

type CronAlertSeverity = "warning" | "error";

interface CronAlert {
  id: string;
  severity: CronAlertSeverity;
  message: string;
}

function parseIsoToMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function buildCronAlerts({
  strategyStatus,
  statusRequestError,
  actionError,
}: {
  strategyStatus: StrategyStatus | null;
  statusRequestError: string | null;
  actionError: string | null;
}): CronAlert[] {
  const alerts: CronAlert[] = [];

  if (statusRequestError) {
    alerts.push({
      id: "status-request-error",
      severity: "error",
      message: statusRequestError,
    });
  }

  if (actionError) {
    alerts.push({
      id: "strategy-action-error",
      severity: "error",
      message: actionError,
    });
  }

  if (!strategyStatus) {
    return alerts;
  }

  if (strategyStatus.lastError) {
    alerts.push({
      id: "last-run-error",
      severity: "error",
      message: `Last strategy run failed: ${strategyStatus.lastError}`,
    });
  }

  if (!strategyStatus.running) {
    return alerts;
  }

  const nowMs = Date.now();
  const lastRunAtMs = parseIsoToMs(strategyStatus.lastRunAt);
  const startedAtMs = parseIsoToMs(strategyStatus.startedAt);

  if (lastRunAtMs && nowMs - lastRunAtMs > STRATEGY_CRON_STALE_MS) {
    alerts.push({
      id: "stale-last-run",
      severity: "warning",
      message: "Cron looks stale: no successful run in the last 40 minutes.",
    });
  }

  if (
    !lastRunAtMs &&
    startedAtMs &&
    nowMs - startedAtMs > STRATEGY_CRON_NO_RUN_AFTER_START_MS
  ) {
    alerts.push({
      id: "never-ran-after-start",
      severity: "warning",
      message: "Strategy started but no successful run has been recorded yet.",
    });
  }

  return alerts;
}

export function Dashboard() {
  const headerRef = useDashboardHeaderHeight();
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
  const [statusRequestError, setStatusRequestError] = useState<string | null>(
    null,
  );
  const [strategyActionError, setStrategyActionError] = useState<string | null>(
    null,
  );
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [closePositionError, setClosePositionError] = useState<string | null>(
    null,
  );
  const lastNotificationKeyRef = useRef<string | null>(null);

  const selectUsdtSymbol = useCallback((symbol: string) => {
    if (isUsdtSymbol(symbol)) {
      setSelectedSymbol(symbol);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoadingPortfolio(true);
    setStatusRequestError(null);

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
        const rows: SymbolRow[] = symbols
          .filter((symbol) => isUsdtSymbol(symbol))
          .map((symbol) => ({
            symbol,
            close: null,
          }));
        setSymbolRows(rows);

        if (
          rows.length > 0 &&
          !rows.some((row) => row.symbol === selectedSymbol)
        ) {
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
        const status = (await strategyRes.json()) as StrategyStatus;
        setStrategyStatus({
          ...status,
          nextRunAt:
            status.nextRunAt ??
            (status.running ? computeNextStrategyCronRunIso(Date.now()) : null),
        });
      } else {
        const body = (await strategyRes.text()) || "unknown error";
        setStatusRequestError(
          `Could not fetch strategy status (${strategyRes.status}): ${body}`,
        );
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

  const closePosition = async (symbol: string) => {
    const confirmed = window.confirm(
      `Close ${symbol} at the latest closed H1 price? This records a paper SELL and starts the 24h re-entry cooldown.`,
    );
    if (!confirmed) {
      return;
    }

    setClosingSymbol(symbol);
    setClosePositionError(null);
    try {
      const response = await fetch("/api/positions/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      if (!response.ok) {
        const body = (await response.text()) || "unknown error";
        setClosePositionError(
          `Could not close ${symbol} (${response.status}): ${body}`,
        );
        return;
      }
      await refresh();
    } finally {
      setClosingSymbol(null);
    }
  };

  const toggleStrategy = async () => {
    setStrategyActionPending(true);
    setStrategyActionError(null);
    try {
      const action = strategyStatus?.running ? "stop" : "start";
      const response = await fetch(`/api/strategy/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.text()) || "unknown error";
        setStrategyActionError(
          `Could not ${action} strategy (${response.status}): ${body}`,
        );
      }
      await refresh();
    } finally {
      setStrategyActionPending(false);
    }
  };

  const disableStrategyButton =
    strategyActionPending || (loadingPortfolio && !strategyStatus?.running);
  const cronAlerts = useMemo(
    () =>
      buildCronAlerts({
        strategyStatus,
        statusRequestError,
        actionError: strategyActionError,
      }),
    [statusRequestError, strategyActionError, strategyStatus],
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      cronAlerts.length === 0
    ) {
      return;
    }

    const highestSeverityAlert =
      cronAlerts.find((alert) => alert.severity === "error") ?? cronAlerts[0];
    const notificationKey = `${highestSeverityAlert.id}:${highestSeverityAlert.message}`;
    if (lastNotificationKeyRef.current === notificationKey) {
      return;
    }
    lastNotificationKeyRef.current = notificationKey;

    new Notification("Strategy cron issue", {
      body: highestSeverityAlert.message,
    });
  }, [cronAlerts]);

  return (
    <div className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <header
        ref={headerRef}
        className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Binance Trading Dashboard</h1>
            <p className="text-sm text-zinc-500">
              {STRATEGY_DESCRIPTION}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <PushNotificationToggle />
            <button
              type="button"
              onClick={() => void toggleStrategy()}
              disabled={disableStrategyButton}
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
        <div className="mt-2 w-full text-xs text-zinc-500">
          <span className="inline-flex items-center gap-2">
            <span>
              Status:{" "}
              {strategyStatus?.runningNow
                ? "Running now"
                : strategyStatus?.running
                  ? "Started"
                  : "Stopped"}
            </span>
            {strategyStatus?.running && strategyStatus.nextRunAt ? (
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
        {cronAlerts.length > 0 ? (
          <div className="mt-3 w-full space-y-2">
            {cronAlerts.map((alert) => (
              <p
                key={alert.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  alert.severity === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                }`}
              >
                {alert.message}
              </p>
            ))}
          </div>
        ) : null}
        <div className="mt-4 w-full">
          <PortfolioSummary portfolio={portfolio} loading={loadingPortfolio} />
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="relative flex w-full shrink-0 flex-col gap-4">
          <SymbolList
            symbols={symbolRows}
            selectedSymbol={selectedSymbol}
            onSelect={selectUsdtSymbol}
            loading={loadingSymbols}
          />
          <div className="flex min-w-0 flex-col gap-4 lg:ml-72 lg:pl-4 xl:ml-80">
            <section
              className={`flex w-full flex-col ${MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME} rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950`}
            >
              <h2 className="mb-3 shrink-0 text-sm font-medium text-zinc-500">
                {selectedSymbol} · H1
              </h2>
              <PriceChart
                symbol={selectedSymbol}
                interval={STRATEGY_INTERVAL}
              />
            </section>

            <section
              className={`flex w-full flex-col ${MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME} rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950`}
            >
              <h2 className="mb-3 shrink-0 text-sm font-medium text-zinc-500">
                Strategy equity (hourly)
              </h2>
              <EquityCurve snapshots={snapshots} loading={loadingPortfolio} />
            </section>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 max-lg:shrink-0 lg:min-h-0 lg:flex-1 lg:flex-row">
          <section
            className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white pt-4 dark:border-zinc-800 dark:bg-zinc-950 ${MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME} lg:min-h-[24rem]`}
          >
            <h2 className="mb-3 shrink-0 px-4 text-sm font-medium text-zinc-500">
              Open positions
            </h2>
            {closePositionError ? (
              <p className="mb-3 mx-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {closePositionError}
              </p>
            ) : null}
            <PositionsTable
              positions={portfolio?.positions ?? []}
              onSymbolSelect={selectUsdtSymbol}
              onClosePosition={closePosition}
              closingSymbol={closingSymbol}
              loading={loadingPortfolio}
            />
          </section>

          <section
            className={`flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white pt-4 dark:border-zinc-800 dark:bg-zinc-950 ${MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME} lg:min-h-[24rem]`}
          >
            <h2 className="mb-3 shrink-0 px-4 text-sm font-medium text-zinc-500">
              Recent trades
            </h2>
            <TradesTable
              trades={trades}
              onSymbolSelect={selectUsdtSymbol}
              loading={loadingPortfolio}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
