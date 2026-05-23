import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { strategyMeta } from "@/db/schema";
import type { CandleInterval } from "@/types/binance";

function metaKey(interval: CandleInterval): string {
  return `last_candle_${interval}`;
}

export async function getLastCandleTime(
  interval: CandleInterval,
): Promise<number | null> {
  const [row] = await getDb()
    .select()
    .from(strategyMeta)
    .where(eq(strategyMeta.key, metaKey(interval)))
    .limit(1);

  if (!row) {
    return null;
  }

  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function setLastCandleTime({
  interval,
  openTime,
}: {
  interval: CandleInterval;
  openTime: number;
}): Promise<void> {
  await getDb()
    .insert(strategyMeta)
    .values({ key: metaKey(interval), value: String(openTime) })
    .onConflictDoUpdate({
      target: strategyMeta.key,
      set: { value: String(openTime) },
    });
}
