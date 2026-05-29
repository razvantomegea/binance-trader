import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { trades } from "@/db/schema";

export async function getLastSymbolCloseTime(
  symbol: string,
): Promise<number | null> {
  const [row] = await getDb()
    .select({ candleOpenTime: trades.candleOpenTime })
    .from(trades)
    .where(and(eq(trades.symbol, symbol), eq(trades.side, "SELL")))
    .orderBy(desc(trades.candleOpenTime))
    .limit(1);

  return row ? row.candleOpenTime.getTime() : null;
}
