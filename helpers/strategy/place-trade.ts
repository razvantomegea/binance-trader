import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { positions, trades } from "@/db/schema";
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

  await getDb().transaction(async (tx) => {
    const [trade] = await tx
      .insert(trades)
      .values({
        symbol,
        side,
        qty: String(qty),
        price: String(price),
        notional: String(notional),
        interval,
        candleOpenTime: candleDate,
        reason,
      })
      .returning({ id: trades.id });

    if (side === "BUY") {
      await tx.insert(positions).values({
        symbol,
        qty: String(qty),
        buyPrice: String(price),
        buyTime: candleDate,
        buyTradeId: trade!.id,
      });
      return;
    }

    await tx.delete(positions).where(eq(positions.symbol, symbol));
  });
}
