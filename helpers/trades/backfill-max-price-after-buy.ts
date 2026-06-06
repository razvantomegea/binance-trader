import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { trades } from "@/db/schema";
import type { CandleInterval } from "@/types/binance";
import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";
import { parseFiniteNumber } from "@/utils/parse-finite-number";
import { computePeakWhilePositionOpen } from "@/utils/strategy/peak-while-open";

export interface BackfillMaxPriceAfterBuyResult {
  scanned: number;
  updated: number;
  skipped: number;
}

interface BuyLookupRow {
  symbol: string;
  price: string;
  candleOpenTime: Date;
  createdAt: Date;
}

function findBuyForSell(
  sell: { symbol: string; createdAt: Date },
  buysBySymbol: Map<string, BuyLookupRow[]>,
): BuyLookupRow | undefined {
  const buys = buysBySymbol.get(sell.symbol) ?? [];
  let matched: BuyLookupRow | undefined;

  for (const buy of buys) {
    if (buy.createdAt < sell.createdAt) {
      matched = buy;
    }
  }

  return matched;
}

async function loadBuysBySymbol(
  symbols: string[],
): Promise<Map<string, BuyLookupRow[]>> {
  if (symbols.length === 0) {
    return new Map();
  }

  const buyRows = await getDb()
    .select({
      symbol: trades.symbol,
      price: trades.price,
      candleOpenTime: trades.candleOpenTime,
      createdAt: trades.createdAt,
    })
    .from(trades)
    .where(and(inArray(trades.symbol, symbols), eq(trades.side, "BUY")))
    .orderBy(asc(trades.createdAt));

  const buysBySymbol = new Map<string, BuyLookupRow[]>();
  for (const row of buyRows) {
    const list = buysBySymbol.get(row.symbol) ?? [];
    list.push(row);
    buysBySymbol.set(row.symbol, list);
  }

  return buysBySymbol;
}

function peaksMatch(stored: string | null, computed: number): boolean {
  if (stored === null) {
    return false;
  }

  const storedValue = parseFiniteNumber(stored);
  if (!Number.isFinite(storedValue)) {
    return false;
  }

  return Math.abs(storedValue - computed) <= storedValue * 1e-9;
}

export async function backfillMaxPriceAfterBuy(): Promise<BackfillMaxPriceAfterBuyResult> {
  const sellRows = await getDb()
    .select({
      id: trades.id,
      symbol: trades.symbol,
      maxPriceAfterBuy: trades.maxPriceAfterBuy,
      interval: trades.interval,
      candleOpenTime: trades.candleOpenTime,
      createdAt: trades.createdAt,
    })
    .from(trades)
    .where(eq(trades.side, "SELL"))
    .orderBy(asc(trades.createdAt));

  const symbols = [...new Set(sellRows.map((row) => row.symbol))];
  const buysBySymbol = await loadBuysBySymbol(symbols);

  let updated = 0;
  let skipped = 0;

  for (const sell of sellRows) {
    const buy = findBuyForSell(sell, buysBySymbol);
    if (!buy) {
      skipped += 1;
      continue;
    }

    const buyPrice = parseFiniteNumber(buy.price);
    const buyOpenTime = buy.candleOpenTime.getTime();
    const sellOpenTime = sell.candleOpenTime.getTime();

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      skipped += 1;
      continue;
    }

    let klines;
    try {
      klines = await getHistoricalClosedKlines({
        symbol: sell.symbol,
        interval: sell.interval as CandleInterval,
        startTime: buyOpenTime,
        endTime: sellOpenTime,
      });
    } catch (error) {
      console.error(
        `Max-price-after-buy backfill failed for trade ${sell.id}:`,
        error,
      );
      skipped += 1;
      continue;
    }

    const computedPeak = computePeakWhilePositionOpen({
      buyPrice,
      buyOpenTime,
      klines,
      sellOpenTime,
    });

    if (peaksMatch(sell.maxPriceAfterBuy, computedPeak)) {
      skipped += 1;
      continue;
    }

    await getDb()
      .update(trades)
      .set({ maxPriceAfterBuy: String(computedPeak) })
      .where(eq(trades.id, sell.id));
    updated += 1;
  }

  return {
    scanned: sellRows.length,
    updated,
    skipped,
  };
}
