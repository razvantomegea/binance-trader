import { eq } from "drizzle-orm";

import { EXIT_DRAWDOWN_PCT } from "@/constants/binance";
import { getDb } from "@/db";
import { strategyMeta } from "@/db/schema";
import type { CandleInterval } from "@/types/binance";

const META_KEY_PREFIX = "exposure_peak_equity";

function metaKey(interval: CandleInterval): string {
  return `${META_KEY_PREFIX}_${interval}`;
}

export async function getExposurePeakEquity(
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
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function setExposurePeakEquity(params: {
  interval: CandleInterval;
  peakEquity: number | null;
}): Promise<void> {
  if (params.peakEquity === null) {
    await getDb()
      .delete(strategyMeta)
      .where(eq(strategyMeta.key, metaKey(params.interval)));
    return;
  }

  await getDb()
    .insert(strategyMeta)
    .values({
      key: metaKey(params.interval),
      value: String(params.peakEquity),
    })
    .onConflictDoUpdate({
      target: strategyMeta.key,
      set: { value: String(params.peakEquity) },
    });
}

export function isPortfolioDrawdownBreached(params: {
  equity: number;
  exposurePeakEquity: number;
  thresholdPct?: number;
}): boolean {
  const threshold = params.thresholdPct ?? EXIT_DRAWDOWN_PCT;
  if (params.exposurePeakEquity <= 0) {
    return false;
  }
  return params.equity <= params.exposurePeakEquity * (1 - threshold);
}

export function nextExposurePeakEquity(params: {
  currentPeak: number | null;
  equity: number;
  hasOpenPositions: boolean;
}): number | null {
  if (!params.hasOpenPositions) {
    return null;
  }

  if (params.currentPeak === null) {
    return params.equity;
  }

  return Math.max(params.currentPeak, params.equity);
}
