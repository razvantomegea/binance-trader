import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trades } from "@/db/schema";
import { INITIAL_PAPER_CASH } from "@/constants/binance";

export async function getCash(): Promise<number> {
  const [row] = await getDb()
    .select({
      buyTotal: sql<string>`coalesce(sum(case when ${trades.side} = 'BUY' then ${trades.notional}::numeric else 0 end), 0)`,
      sellTotal: sql<string>`coalesce(sum(case when ${trades.side} = 'SELL' then ${trades.notional}::numeric else 0 end), 0)`,
    })
    .from(trades);

  const buyTotal = Number(row?.buyTotal ?? 0);
  const sellTotal = Number(row?.sellTotal ?? 0);

  return INITIAL_PAPER_CASH + sellTotal - buyTotal;
}
