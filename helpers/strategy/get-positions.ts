import { getDb } from "@/db";
import { positions } from "@/db/schema";

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
      qty: Number(row.qty),
      buyPrice: Number(row.buyPrice),
      buyTime: row.buyTime,
      buyTradeId: row.buyTradeId,
    });
  }

  return map;
}
