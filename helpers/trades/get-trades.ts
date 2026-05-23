import { desc, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trades } from "@/db/schema";
import type { TradesResponse } from "@/types/portfolio";

interface GetTradesParams {
  limit: number;
  offset: number;
}

export async function getTrades({
  limit,
  offset,
}: GetTradesParams): Promise<TradesResponse> {
  const rows = await getDb()
    .select()
    .from(trades)
    .orderBy(desc(trades.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(trades);

  return {
    total: countRow?.total ?? 0,
    trades: rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      side: row.side as "BUY" | "SELL",
      qty: row.qty,
      price: row.price,
      notional: row.notional,
      interval: row.interval,
      candleOpenTime: row.candleOpenTime.toISOString(),
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
