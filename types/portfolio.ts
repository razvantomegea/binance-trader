export type TradeSide = "BUY" | "SELL";

export interface PositionRow {
  symbol: string;
  qty: string;
  buyPrice: string;
  buyTime: string;
  buyTradeId: number;
  currentPrice: string | null;
  unrealizedPnlPct: number | null;
}

export interface PortfolioResponse {
  cash: number;
  equity: number;
  pnlPct: number;
  positionCount: number;
  positions: PositionRow[];
}

export interface TradeRow {
  id: number;
  symbol: string;
  side: TradeSide;
  qty: string;
  price: string;
  notional: string;
  interval: string;
  candleOpenTime: string;
  reason: string;
  createdAt: string;
}

export interface TradesResponse {
  trades: TradeRow[];
  total: number;
}

export interface EquitySnapshotRow {
  id: number;
  ts: string;
  cash: number;
  equity: number;
  interval: string;
}

export interface EquityCurveResponse {
  snapshots: EquitySnapshotRow[];
}
