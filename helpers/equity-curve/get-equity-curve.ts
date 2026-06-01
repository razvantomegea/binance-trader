import { desc, eq } from "drizzle-orm";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { getDb } from "@/db";
import { withDbRetry } from "@/db/with-db-retry";
import { equitySnapshots } from "@/db/schema";
import type { EquityCurveResponse } from "@/types/portfolio";

interface GetEquityCurveParams {
  limit: number;
}

export async function getEquityCurve({
  limit,
}: GetEquityCurveParams): Promise<EquityCurveResponse> {
  const rows = await withDbRetry(() =>
    getDb()
      .select()
      .from(equitySnapshots)
      .where(eq(equitySnapshots.interval, STRATEGY_INTERVAL))
      .orderBy(desc(equitySnapshots.ts))
      .limit(limit),
  );

  return {
    snapshots: rows
      .map((row) => ({
        id: row.id,
        ts: row.ts.toISOString(),
        cash: Number(row.cash),
        equity: Number(row.equity),
        interval: row.interval,
      }))
      .reverse(),
  };
}
