import type {
  EquityCurveResponse,
  PortfolioResponse,
  TradesResponse,
} from "@/types/portfolio";

export interface SymbolRow {
  symbol: string;
  close: string | null;
}

export interface StrategyStatus {
  running: boolean;
  runningNow: boolean;
  heartbeatMs: number;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
}

export type CronAlertSeverity = "warning" | "error";

export interface CronAlert {
  id: string;
  severity: CronAlertSeverity;
  message: string;
}

export interface DashboardCoreState {
  selectedSymbol: string;
  symbolRows: SymbolRow[];
  portfolio: PortfolioResponse | null;
  trades: TradesResponse["trades"];
  snapshots: EquityCurveResponse["snapshots"];
  loadingSymbols: boolean;
  loadingPortfolio: boolean;
}

export interface DashboardCoreSetters {
  setSelectedSymbol: (symbol: string) => void;
  setSymbolRows: (rows: SymbolRow[]) => void;
  setPortfolio: (portfolio: PortfolioResponse) => void;
  setTrades: (trades: TradesResponse["trades"]) => void;
  setSnapshots: (snapshots: EquityCurveResponse["snapshots"]) => void;
  setLoadingSymbols: (loading: boolean) => void;
  setLoadingPortfolio: (loading: boolean) => void;
}

export interface StrategyActionState {
  strategyStatus: StrategyStatus | null;
  strategyActionPending: boolean;
  statusRequestError: string | null;
  strategyActionError: string | null;
}

export interface StrategyActionSetters {
  setStrategyStatus: (status: StrategyStatus | null) => void;
  setStrategyActionPending: (pending: boolean) => void;
  setStatusRequestError: (error: string | null) => void;
  setStrategyActionError: (error: string | null) => void;
}

export interface PositionActionState {
  closingSymbol: string | null;
  closePositionError: string | null;
}

export interface PositionActionSetters {
  setClosingSymbol: (symbol: string | null) => void;
  setClosePositionError: (error: string | null) => void;
}

export interface UseDashboardDataResult {
  selectedSymbol: string;
  symbolRows: SymbolRow[];
  portfolio: PortfolioResponse | null;
  trades: TradesResponse["trades"];
  snapshots: EquityCurveResponse["snapshots"];
  loadingSymbols: boolean;
  loadingPortfolio: boolean;
  strategyStatus: StrategyStatus | null;
  strategyActionPending: boolean;
  cronAlerts: CronAlert[];
  closingSymbol: string | null;
  closePositionError: string | null;
  selectUsdtSymbol: (symbol: string) => void;
  refresh: () => Promise<void>;
  closePosition: (symbol: string) => Promise<void>;
  toggleStrategy: () => Promise<void>;
}
