import type { TradePostClose24hMetrics } from "@/types/trade-metrics";

export type TradeSide = "BUY" | "SELL";

export interface PositionRow {
  symbol: string;
  qty: string;
  buyPrice: string;
  maxPriceAfterBuy: string | null;
  buyTime: string;
  buyTradeId: number;
  currentPrice: string | null;
  unrealizedPnlPct: number | null;
}

export interface PortfolioResponse {
  cash: number;
  equity: number;
  pnlPct: number;
  totalPnl: number;
  realizedPnl: number;
  realizedPnlPct: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  positionCount: number;
  positions: PositionRow[];
}

export interface TradeRow extends TradePostClose24hMetrics {
  id: number;
  symbol: string;
  side: TradeSide;
  qty: string;
  price: string;
  /** Entry price (BUY fill, or paired BUY on SELL) */
  openPrice: string | null;
  /** Exit price (SELL fill only) */
  closePrice: string | null;
  /** Maximum observed price from BUY until close; set on BUY and carried through on SELL */
  maxPriceAfterBuy: string | null;
  notional: string;
  interval: string;
  candleOpenTime: string;
  reason: string;
  createdAt: string;
  /** Realized P&L % on SELL (vs paired BUY); null for BUY or unknown pairing */
  realizedPnlPct: number | null;
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
