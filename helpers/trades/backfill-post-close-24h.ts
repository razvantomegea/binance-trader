import { and, eq, isNull, lte } from "drizzle-orm";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { getDb } from "@/db";
import { trades } from "@/db/schema";
import type { CandleInterval } from "@/types/binance";
import { POST_CLOSE_WINDOW_CANDLES } from "@/types/trade-metrics";
import { getLastClosedCandleOpenTime } from "@/utils/binance/candle-time";
import { HOUR_MS } from "@/utils/binance/candle-time";
import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";
import { computePostClose24hExtrema } from "@/utils/trade/compute-post-close-24h-extrema";
import { parseFiniteNumber } from "@/utils/parse-finite-number";

export interface BackfillPostClose24hResult {
  scanned: number;
  updated: number;
  skipped: number;
}

function toDbNumeric(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return String(value);
}

export async function backfillPostClose24hMetrics(): Promise<BackfillPostClose24hResult> {
  const lastClosedOpenTime = getLastClosedCandleOpenTime();
  const windowMs = POST_CLOSE_WINDOW_CANDLES * HOUR_MS;
  const eligibleBeforeOpenTime = lastClosedOpenTime - windowMs;

  const rows = await getDb()
    .select({
      id: trades.id,
      symbol: trades.symbol,
      price: trades.price,
      interval: trades.interval,
      candleOpenTime: trades.candleOpenTime,
    })
    .from(trades)
    .where(
      and(
        eq(trades.side, "SELL"),
        isNull(trades.maxPriceAfterClose24h),
        lte(trades.candleOpenTime, new Date(eligibleBeforeOpenTime)),
      ),
    )
    .limit(50);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const sellClosePrice = parseFiniteNumber(row.price);
    const sellCandleOpenTime = row.candleOpenTime.getTime();

    if (!Number.isFinite(sellClosePrice) || sellClosePrice <= 0) {
      skipped += 1;
      continue;
    }

    const interval = row.interval as CandleInterval;
    const klinesAsc = await getHistoricalClosedKlines({
      symbol: row.symbol,
      interval,
      startTime: sellCandleOpenTime,
      endTime: sellCandleOpenTime + windowMs,
    });

    const metrics = computePostClose24hExtrema({
      klinesAsc,
      sellCandleOpenTime,
      sellClosePrice,
    });

    if (metrics.maxPriceAfterClose24h === null) {
      skipped += 1;
      continue;
    }

    await getDb()
      .update(trades)
      .set({
        maxPriceAfterClose24h: toDbNumeric(metrics.maxPriceAfterClose24h),
        minPriceAfterClose24h: toDbNumeric(metrics.minPriceAfterClose24h),
        maxPriceAfterClose24hPct: toDbNumeric(metrics.maxPriceAfterClose24hPct),
        minPriceAfterClose24hPct: toDbNumeric(metrics.minPriceAfterClose24hPct),
      })
      .where(eq(trades.id, row.id));

    updated += 1;
  }

  return {
    scanned: rows.length,
    updated,
    skipped,
  };
}

export async function backfillPostClose24hForInterval(
  interval: typeof STRATEGY_INTERVAL = STRATEGY_INTERVAL,
): Promise<BackfillPostClose24hResult> {
  void interval;
  return backfillPostClose24hMetrics();
}
