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
}

export async function placeTrade({
  symbol,
  side,
  qty,
  price,
  interval,
  candleOpenTime,
  reason,
}: PlaceTradeParams): Promise<void> {
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`Invalid qty: ${qty}`);
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price: ${price}`);
  }

  const notional = qty * price;
  const candleDate = new Date(candleOpenTime);

  const db = getDb();
  const [openPosition] =
    side === "SELL"
      ? await db.select().from(positions).where(eq(positions.symbol, symbol))
      : [undefined];

  const maxPriceAfterBuy =
    side === "SELL"
      ? (openPosition?.maxPriceAfterBuy ?? openPosition?.buyPrice ?? null)
      : String(price);

  const postClose24hFields =
    side === "SELL"
      ? {
          maxPriceAfterClose24h: null,
          minPriceAfterClose24h: null,
          maxPriceAfterClose24hPct: null,
          minPriceAfterClose24hPct: null,
        }
      : {};

  const [trade] = await db
    .insert(trades)
    .values({
      symbol,
      side,
      qty: String(qty),
      price: String(price),
      maxPriceAfterBuy,
      notional: String(notional),
      interval,
      candleOpenTime: candleDate,
      reason,
      ...postClose24hFields,
    })
    .returning({ id: trades.id });

  if (!trade) {
    throw new Error("Failed to insert trade");
  }

  try {
    if (side === "BUY") {
      await db.insert(positions).values({
        symbol,
        qty: String(qty),
        buyPrice: String(price),
        maxPriceAfterBuy: String(price),
        buyTime: candleDate,
        buyTradeId: trade.id,
      });
    } else {
      await db.delete(positions).where(eq(positions.symbol, symbol));
    }
  } catch (error) {
    await db.delete(trades).where(eq(trades.id, trade.id));
    throw error;
  }

  const tradeId = trade.id;

  notifyTradeExecuted({
    tradeId,
    symbol,
    side,
    qty,
    price,
    reason,
    interval,
  });
}
