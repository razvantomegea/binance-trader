export enum DataTestId {
  Dashboard = "dashboard",
  DashboardTitle = "dashboard-title",
  PortfolioSummary = "portfolio-summary",
  PortfolioLoading = "portfolio-loading",
  PortfolioError = "portfolio-error",
  PortfolioCash = "portfolio-cash",
  SymbolListLoading = "symbol-list-loading",
  SymbolRow = "symbol-row",
  PriceChartTitle = "price-chart-title",
  PriceChartLoading = "price-chart-loading",
  PriceChartError = "price-chart-error",
  PriceChartReady = "price-chart-ready",
  EquityCurveLoading = "equity-curve-loading",
  PositionsLoading = "positions-loading",
  TradesLoading = "trades-loading",
  StrategyToggle = "strategy-toggle",
  StrategyStatus = "strategy-status",
  CronAlerts = "cron-alerts",
  CronAlert = "cron-alert",
}

export function symbolRowTestId(symbol: string): string {
  return `${DataTestId.SymbolRow}-${symbol}`;
}
