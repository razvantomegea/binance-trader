import type { CandleInterval } from "@/types/binance";

export interface BacktestConfig {
  days: number;
  symbols?: string[];
  initialCash: number;
  concurrency: number;
  feeBps: number;
  interval: CandleInterval;
  /** Test hook: fixed clock for reproducible historical ranges. */
  now?: number;
}

export interface SimTrade {
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  notional: number;
  fee: number;
  candleOpenTime: number;
  reason: string;
  /** Entry price (BUY fill, or paired BUY on SELL) */
  openPrice: number | null;
  /** Exit price (SELL fill only) */
  closePrice: number | null;
  /** Maximum observed price from BUY until close */
  maxPriceAfterBuy: number | null;
  /** Realized P&L % on SELL (vs paired BUY); null for BUY */
  realizedPnlPct: number | null;
}

export interface EquityPoint {
  openTime: number;
  equity: number;
  cash: number;
}

export interface BacktestReport {
  startTime: number;
  endTime: number;
  initialCash: number;
  finalEquity: number;
  pnlPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  totalTrades: number;
  winningTrades: number;
  trades: SimTrade[];
  equityCurve: EquityPoint[];
}
