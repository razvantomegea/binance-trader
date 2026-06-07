import { and, asc, eq, gt, lte } from "drizzle-orm";

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

async function computeRowMetrics(params: {
  row: {
    symbol: string;
    price: string;
    interval: string;
    candleOpenTime: Date;
  };
  windowMs: number;
}) {
  const sellClosePrice = parseFiniteNumber(params.row.price);
  if (!Number.isFinite(sellClosePrice) || sellClosePrice <= 0) {
    return null;
  }

  const sellCandleOpenTime = params.row.candleOpenTime.getTime();
  const klinesAsc = await getHistoricalClosedKlines({
    symbol: params.row.symbol,
    interval: params.row.interval as CandleInterval,
    startTime: sellCandleOpenTime,
    endTime: sellCandleOpenTime + params.windowMs,
  });

  return computePostClose24hExtrema({
    klinesAsc,
    sellCandleOpenTime,
    sellClosePrice,
  });
}

export async function backfillPostClose24hMetrics(): Promise<BackfillPostClose24hResult> {
  const lastClosedOpenTime = getLastClosedCandleOpenTime();
  const windowMs = POST_CLOSE_WINDOW_CANDLES * HOUR_MS;
  const eligibleAfterOpenTime = lastClosedOpenTime - windowMs;

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
        gt(trades.candleOpenTime, new Date(eligibleAfterOpenTime)),
        lte(trades.candleOpenTime, new Date(lastClosedOpenTime)),
      ),
    )
    .orderBy(asc(trades.candleOpenTime), asc(trades.id))
    .limit(50);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const metrics = await computeRowMetrics({ row, windowMs });
      if (metrics?.maxPriceAfterClose24h == null) {
        skipped += 1;
        continue;
      }

      await getDb()
        .update(trades)
        .set({
          maxPriceAfterClose24h: toDbNumeric(metrics.maxPriceAfterClose24h),
          minPriceAfterClose24h: toDbNumeric(metrics.minPriceAfterClose24h),
          maxPriceAfterClose24hPct: toDbNumeric(
            metrics.maxPriceAfterClose24hPct,
          ),
          minPriceAfterClose24hPct: toDbNumeric(
            metrics.minPriceAfterClose24hPct,
          ),
        })
        .where(eq(trades.id, row.id));

      updated += 1;
    } catch (error) {
      skipped += 1;
      console.error(
        `Post-close 24h backfill failed for trade id=${row.id} symbol=${row.symbol} interval=${row.interval}:`,
        error,
      );
    }
  }

  return {
    scanned: rows.length,
    updated,
    skipped,
  };
}
