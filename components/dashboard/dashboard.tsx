"use client";

import type { ReactNode } from "react";

import { MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME } from "@/constants/dashboard-layout";
import { ALLOW_DASHBOARD_MUTATIONS } from "@/constants/environment";
import { DataTestId } from "@/constants/data-test-id";
import { EquityCurve } from "@/components/equity-curve";
import { PortfolioSummary } from "@/components/portfolio-summary";
import { PositionsTable } from "@/components/positions-table";
import { PriceChart } from "@/components/price-chart";
import { SymbolList } from "@/components/symbol-list";
import { TradesTable } from "@/components/trades-table";
import { StrategyControls } from "@/components/dashboard/strategy-controls";
import { STRATEGY_DESCRIPTION } from "@/components/dashboard/strategy-description";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { useDashboardHeaderHeight } from "@/hooks/use-dashboard-header-height";

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-screen w-full min-w-0 flex-col overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50"
      data-testid={DataTestId.Dashboard}
    >
      {children}
    </div>
  );
}

export function Dashboard() {
  const headerRef = useDashboardHeaderHeight();
  const {
    selectedSymbol,
    symbolRows,
    portfolio,
    trades,
    snapshots,
    loadingSymbols,
    loadingPortfolio,
    strategyStatus,
    strategyActionPending,
    cronAlerts,
    closingSymbol,
    closePositionError,
    selectUsdtSymbol,
    closePosition,
    toggleStrategy,
  } = useDashboardData();

  return (
    <DashboardShell>
      <header
        ref={headerRef}
        className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <DashboardHeader
          strategyStatus={strategyStatus}
          strategyActionPending={strategyActionPending}
          loadingPortfolio={loadingPortfolio}
          cronAlerts={cronAlerts}
          onToggleStrategy={toggleStrategy}
        />
        <div className="mt-4 w-full">
          <PortfolioSummary portfolio={portfolio} loading={loadingPortfolio} />
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto p-4">
        <DashboardCharts
          symbolRows={symbolRows}
          selectedSymbol={selectedSymbol}
          loadingSymbols={loadingSymbols}
          loadingPortfolio={loadingPortfolio}
          snapshots={snapshots}
          onSelectSymbol={selectUsdtSymbol}
        />
        <DashboardTables
          portfolioPositions={portfolio?.positions ?? []}
          trades={trades}
          loadingPortfolio={loadingPortfolio}
          closingSymbol={closingSymbol}
          closePositionError={closePositionError}
          onSelectSymbol={selectUsdtSymbol}
          onClosePosition={
            ALLOW_DASHBOARD_MUTATIONS ? closePosition : undefined
          }
        />
      </main>
    </DashboardShell>
  );
}

function DashboardHeader({
  strategyStatus,
  strategyActionPending,
  loadingPortfolio,
  cronAlerts,
  onToggleStrategy,
}: {
  strategyStatus: Parameters<typeof StrategyControls>[0]["strategyStatus"];
  strategyActionPending: Parameters<
    typeof StrategyControls
  >[0]["strategyActionPending"];
  loadingPortfolio: Parameters<typeof StrategyControls>[0]["loadingPortfolio"];
  cronAlerts: Parameters<typeof StrategyControls>[0]["cronAlerts"];
  onToggleStrategy: Parameters<typeof StrategyControls>[0]["onToggleStrategy"];
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-4">
      <div>
        <h1
          className="text-xl font-semibold"
          data-testid={DataTestId.DashboardTitle}
        >
          Binance Trading Dashboard
        </h1>
        <p className="text-sm text-zinc-500">{STRATEGY_DESCRIPTION}</p>
      </div>
      <StrategyControls
        strategyStatus={strategyStatus}
        strategyActionPending={strategyActionPending}
        loadingPortfolio={loadingPortfolio}
        cronAlerts={cronAlerts}
        onToggleStrategy={onToggleStrategy}
      />
    </div>
  );
}

function DashboardCharts({
  symbolRows,
  selectedSymbol,
  loadingSymbols,
  loadingPortfolio,
  snapshots,
  onSelectSymbol,
}: {
  symbolRows: Parameters<typeof SymbolList>[0]["symbols"];
  selectedSymbol: string;
  loadingSymbols: boolean;
  loadingPortfolio: boolean;
  snapshots: Parameters<typeof EquityCurve>[0]["snapshots"];
  onSelectSymbol: Parameters<typeof SymbolList>[0]["onSelect"];
}) {
  return (
    <div className="relative flex w-full shrink-0 flex-col gap-4">
      <SymbolList
        symbols={symbolRows}
        selectedSymbol={selectedSymbol}
        onSelect={onSelectSymbol}
        loading={loadingSymbols}
      />
      <div className="flex min-w-0 flex-col gap-4 lg:ml-72 lg:pl-4 xl:ml-80">
        <section
          className={`flex w-full flex-col ${MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME} rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950`}
        >
          <h2
            className="mb-3 shrink-0 text-sm font-medium text-zinc-500"
            data-testid={DataTestId.PriceChartTitle}
          >
            {selectedSymbol} · H1
          </h2>
          <PriceChart symbol={selectedSymbol} interval={STRATEGY_INTERVAL} />
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
  );
}

function DashboardTables({
  portfolioPositions,
  trades,
  loadingPortfolio,
  closingSymbol,
  closePositionError,
  onSelectSymbol,
  onClosePosition,
}: {
  portfolioPositions: Parameters<typeof PositionsTable>[0]["positions"];
  trades: Parameters<typeof TradesTable>[0]["trades"];
  loadingPortfolio: boolean;
  closingSymbol: string | null;
  closePositionError: string | null;
  onSelectSymbol: Parameters<typeof PositionsTable>[0]["onSymbolSelect"];
  onClosePosition: Parameters<typeof PositionsTable>[0]["onClosePosition"];
}) {
  return (
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
          positions={portfolioPositions}
          onSymbolSelect={onSelectSymbol}
          onClosePosition={onClosePosition}
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
          onSymbolSelect={onSelectSymbol}
          loading={loadingPortfolio}
        />
      </section>
    </div>
  );
}
