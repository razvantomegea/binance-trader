import { getDb } from "@/db";
import { positions } from "@/db/schema";
import { parseFiniteNumber } from "@/utils/parse-finite-number";

export interface OpenPosition {
  symbol: string;
  qty: number;
  buyPrice: number;
  buyTime: Date;
  buyTradeId: number;
}

export async function getOpenPositions(): Promise<Map<string, OpenPosition>> {
  const rows = await getDb().select().from(positions);
  const map = new Map<string, OpenPosition>();

  for (const row of rows) {
    map.set(row.symbol, {
      symbol: row.symbol,
      qty: parseFiniteNumber(row.qty),
      buyPrice: parseFiniteNumber(row.buyPrice),
      buyTime: row.buyTime,
      buyTradeId: row.buyTradeId,
    });
  }

  return map;
}
