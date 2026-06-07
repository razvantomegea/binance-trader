"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import type {
  EquityCurveResponse,
  PortfolioResponse,
  TradesResponse,
} from "@/types/portfolio";

import { buildCronAlerts } from "@/components/dashboard/cron-alerts";
import {
  applyRefreshData,
  fetchAndReadDashboardData,
} from "@/components/dashboard/dashboard-data-requests";
import type {
  CronAlert,
  DashboardCoreSetters,
  DashboardCoreState,
  PositionActionSetters,
  PositionActionState,
  StrategyActionSetters,
  StrategyActionState,
  StrategyStatus,
  SymbolRow,
  UseDashboardDataResult,
} from "@/components/dashboard/types";

const POLL_MS = 30_000;
const DEFAULT_SYMBOL = "BTCUSDT";

function useDashboardCoreState(): DashboardCoreState & DashboardCoreSetters {
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL);
  const [symbolRows, setSymbolRows] = useState<SymbolRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [trades, setTrades] = useState<TradesResponse["trades"]>([]);
  const [snapshots, setSnapshots] = useState<EquityCurveResponse["snapshots"]>(
    [],
  );
  const [loadingSymbols, setLoadingSymbols] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  return {
    selectedSymbol,
    symbolRows,
    portfolio,
    trades,
    snapshots,
    loadingSymbols,
    loadingPortfolio,
    setSelectedSymbol,
    setSymbolRows,
    setPortfolio,
    setTrades,
    setSnapshots,
    setLoadingSymbols,
    setLoadingPortfolio,
  };
}

function useStrategyActionState(): StrategyActionState & StrategyActionSetters {
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
  return {
    strategyStatus,
    strategyActionPending,
    statusRequestError,
    strategyActionError,
    setStrategyStatus,
    setStrategyActionPending,
    setStatusRequestError,
    setStrategyActionError,
  };
}

function usePositionActionState(): PositionActionState & PositionActionSetters {
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [closePositionError, setClosePositionError] = useState<string | null>(
    null,
  );
  return {
    closingSymbol,
    closePositionError,
    setClosingSymbol,
    setClosePositionError,
  };
}

interface DashboardRefreshParams {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  setSymbolRows: (rows: SymbolRow[]) => void;
  setPortfolio: (portfolio: PortfolioResponse) => void;
  setTrades: (trades: TradesResponse["trades"]) => void;
  setSnapshots: (snapshots: EquityCurveResponse["snapshots"]) => void;
  setLoadingSymbols: (loading: boolean) => void;
  setLoadingPortfolio: (loading: boolean) => void;
  setStrategyStatus: (status: StrategyStatus | null) => void;
  setStatusRequestError: (error: string | null) => void;
}

function useDashboardRefresh({
  selectedSymbol,
  setSelectedSymbol,
  setSymbolRows,
  setPortfolio,
  setTrades,
  setSnapshots,
  setLoadingSymbols,
  setLoadingPortfolio,
  setStrategyStatus,
  setStatusRequestError,
}: DashboardRefreshParams): () => Promise<void> {
  return useCallback(async () => {
    setLoadingPortfolio(true);
    setStatusRequestError(null);
    try {
      const { rows, portfolioData, tradesData, snapshotsData, strategyRead } =
        await fetchAndReadDashboardData();
      applyRefreshData({
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
      });
    } finally {
      setLoadingSymbols(false);
      setLoadingPortfolio(false);
    }
  }, [
    selectedSymbol,
    setLoadingPortfolio,
    setStatusRequestError,
    setSymbolRows,
    setSelectedSymbol,
    setPortfolio,
    setTrades,
    setSnapshots,
    setStrategyStatus,
    setLoadingSymbols,
  ]);
}

function usePollingRefresh(refresh: () => Promise<void>): void {
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) {
        return;
      }
      try {
        await refresh();
      } catch (error) {
        if (!cancelled) {
          console.error("Dashboard polling refresh failed:", error);
        }
      }
    };
    const timer = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    const initial = window.setTimeout(() => {
      void tick();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);
}

function useClosePositionAction({
  refresh,
  setClosingSymbol,
  setClosePositionError,
}: {
  refresh: () => Promise<void>;
  setClosingSymbol: (symbol: string | null) => void;
  setClosePositionError: (error: string | null) => void;
}): (symbol: string) => Promise<void> {
  return useCallback(
    async (symbol: string) => {
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
    },
    [refresh, setClosingSymbol, setClosePositionError],
  );
}

function useToggleStrategyAction({
  refresh,
  strategyStatus,
  setStrategyActionPending,
  setStrategyActionError,
}: {
  refresh: () => Promise<void>;
  strategyStatus: StrategyStatus | null;
  setStrategyActionPending: (pending: boolean) => void;
  setStrategyActionError: (error: string | null) => void;
}): () => Promise<void> {
  return useCallback(async () => {
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
  }, [
    refresh,
    strategyStatus?.running,
    setStrategyActionPending,
    setStrategyActionError,
  ]);
}

function useCronAlerts({
  strategyStatus,
  statusRequestError,
  strategyActionError,
}: {
  strategyStatus: StrategyStatus | null;
  statusRequestError: string | null;
  strategyActionError: string | null;
}): CronAlert[] {
  return useMemo(
    () =>
      buildCronAlerts({
        strategyStatus,
        statusRequestError,
        actionError: strategyActionError,
      }),
    [statusRequestError, strategyActionError, strategyStatus],
  );
}

function useCronNotifications(cronAlerts: CronAlert[]): void {
  const lastNotificationKeyRef = useRef<string | null>(null);
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
}

export function useDashboardData(): UseDashboardDataResult {
  const core = useDashboardCoreState();
  const strategy = useStrategyActionState();
  const position = usePositionActionState();
  const { setSelectedSymbol } = core;

  const selectUsdtSymbol = useCallback(
    (symbol: string) => {
      if (isUsdtSymbol(symbol)) {
        setSelectedSymbol(symbol);
      }
    },
    [setSelectedSymbol],
  );

  const refresh = useDashboardRefresh({
    selectedSymbol: core.selectedSymbol,
    setSelectedSymbol,
    setSymbolRows: core.setSymbolRows,
    setPortfolio: core.setPortfolio,
    setTrades: core.setTrades,
    setSnapshots: core.setSnapshots,
    setLoadingSymbols: core.setLoadingSymbols,
    setLoadingPortfolio: core.setLoadingPortfolio,
    setStrategyStatus: strategy.setStrategyStatus,
    setStatusRequestError: strategy.setStatusRequestError,
  });
  usePollingRefresh(refresh);

  const closePosition = useClosePositionAction({
    refresh,
    setClosingSymbol: position.setClosingSymbol,
    setClosePositionError: position.setClosePositionError,
  });
  const toggleStrategy = useToggleStrategyAction({
    refresh,
    strategyStatus: strategy.strategyStatus,
    setStrategyActionPending: strategy.setStrategyActionPending,
    setStrategyActionError: strategy.setStrategyActionError,
  });

  const cronAlerts = useCronAlerts({
    strategyStatus: strategy.strategyStatus,
    statusRequestError: strategy.statusRequestError,
    strategyActionError: strategy.strategyActionError,
  });
  useCronNotifications(cronAlerts);

  return {
    selectedSymbol: core.selectedSymbol,
    symbolRows: core.symbolRows,
    portfolio: core.portfolio,
    trades: core.trades,
    snapshots: core.snapshots,
    loadingSymbols: core.loadingSymbols,
    loadingPortfolio: core.loadingPortfolio,
    strategyStatus: strategy.strategyStatus,
    strategyActionPending: strategy.strategyActionPending,
    cronAlerts,
    closingSymbol: position.closingSymbol,
    closePositionError: position.closePositionError,
    selectUsdtSymbol,
    refresh,
    closePosition,
    toggleStrategy,
  };
}
