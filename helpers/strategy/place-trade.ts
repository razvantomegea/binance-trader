import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { positions, trades } from "@/db/schema";
import { notifyTradeExecuted } from "@/helpers/notifications/notify-trade-executed";
import type { CandleInterval } from "@/types/binance";
import type { TradeSide } from "@/types/portfolio";

interface PlaceTradeParams {
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
  interval: CandleInterval;
  candleOpenTime: number;
  reason: string;
  /** Peak price used for trailing-stop tracking (buy candle high or exit peak). */
  maxPriceAfterBuy?: number;
}

function assertValidTradeInput(params: PlaceTradeParams) {
  if (!Number.isFinite(params.qty) || params.qty <= 0) {
    throw new Error(`Invalid qty: ${params.qty}`);
  }
  if (!Number.isFinite(params.price) || params.price <= 0) {
    throw new Error(`Invalid price: ${params.price}`);
  }
}

async function loadOpenPositionForSell(params: {
  db: ReturnType<typeof getDb>;
  side: TradeSide;
  symbol: string;
}) {
  if (params.side !== "SELL") {
    return undefined;
  }
  const [openPosition] = await params.db
    .select()
    .from(positions)
    .where(eq(positions.symbol, params.symbol));
  if (!openPosition) {
    throw new Error(
      `Cannot execute SELL: no open position for symbol ${params.symbol}`,
    );
  }
  return openPosition;
}

function resolveMaxPriceAfterBuyValue(params: {
  side: TradeSide;
  maxPriceAfterBuy?: number;
  openPosition?: { maxPriceAfterBuy: string | null; buyPrice: string };
  price: number;
}): string | null {
  if (params.maxPriceAfterBuy !== undefined) {
    return String(params.maxPriceAfterBuy);
  }
  if (params.side === "SELL") {
    return (
      params.openPosition?.maxPriceAfterBuy ??
      params.openPosition?.buyPrice ??
      null
    );
  }
  return String(params.price);
}

function buildPostClose24hFields(side: TradeSide) {
  if (side !== "SELL") {
    return {};
  }
  return {
    maxPriceAfterClose24h: null,
    minPriceAfterClose24h: null,
    maxPriceAfterClose24hPct: null,
    minPriceAfterClose24hPct: null,
  };
}

async function syncPositionWithTrade(params: {
  db: ReturnType<typeof getDb>;
  tradeId: number;
  side: TradeSide;
  symbol: string;
  qty: number;
  price: number;
  candleDate: Date;
  maxPriceAfterBuy?: number;
}) {
  if (params.side === "BUY") {
    await params.db.insert(positions).values({
      symbol: params.symbol,
      qty: String(params.qty),
      buyPrice: String(params.price),
      maxPriceAfterBuy:
        params.maxPriceAfterBuy !== undefined
          ? String(params.maxPriceAfterBuy)
          : String(params.price),
      buyTime: params.candleDate,
      buyTradeId: params.tradeId,
    });
    return;
  }
  await params.db.delete(positions).where(eq(positions.symbol, params.symbol));
}

async function executeTradeWorkflow({
  symbol,
  side,
  qty,
  price,
  interval,
  candleOpenTime,
  reason,
  maxPriceAfterBuy,
}: PlaceTradeParams): Promise<void> {
  const db = getDb();
  const candleDate = new Date(candleOpenTime);
  const trade = await insertTradeRow({
    db,
    symbol,
    side,
    qty,
    price,
    interval,
    reason,
    candleDate,
    maxPriceAfterBuy,
  });
  await syncPositionWithRollback({
    db,
    tradeId: trade.id,
    side,
    symbol,
    qty,
    price,
    candleDate,
    maxPriceAfterBuy,
  });
  notifyTradeExecuted({
    tradeId: trade.id,
    symbol,
    side,
    qty,
    price,
    reason,
    interval,
  });
}

async function insertTradeRow(params: {
  db: ReturnType<typeof getDb>;
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
  interval: CandleInterval;
  reason: string;
  candleDate: Date;
  maxPriceAfterBuy?: number;
}) {
  const openPosition = await loadOpenPositionForSell(params);
  const resolvedMaxPriceAfterBuy = resolveMaxPriceAfterBuyValue({
    side: params.side,
    maxPriceAfterBuy: params.maxPriceAfterBuy,
    openPosition,
    price: params.price,
  });
  const [trade] = await params.db
    .insert(trades)
    .values({
      symbol: params.symbol,
      side: params.side,
      qty: String(params.qty),
      price: String(params.price),
      maxPriceAfterBuy: resolvedMaxPriceAfterBuy,
      notional: String(params.qty * params.price),
      interval: params.interval,
      candleOpenTime: params.candleDate,
      reason: params.reason,
      ...buildPostClose24hFields(params.side),
    })
    .returning({ id: trades.id });
  if (!trade) {
    throw new Error("Failed to insert trade");
  }
  return trade;
}

async function syncPositionWithRollback(params: {
  db: ReturnType<typeof getDb>;
  tradeId: number;
  side: TradeSide;
  symbol: string;
  qty: number;
  price: number;
  candleDate: Date;
  maxPriceAfterBuy?: number;
}) {
  try {
    await syncPositionWithTrade(params);
  } catch (error) {
    await params.db.delete(trades).where(eq(trades.id, params.tradeId));
    throw error;
  }
}

export async function placeTrade(params: PlaceTradeParams): Promise<void> {
  assertValidTradeInput(params);
  await executeTradeWorkflow(params);
}
