import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trades } from "@/db/schema";
import { mapPostClose24hFromDb } from "@/helpers/trades/map-post-close-24h-fields";
import type { TradePostClose24hMetrics } from "@/types/trade-metrics";
import { NULL_TRADE_POST_CLOSE_24H } from "@/types/trade-metrics";
import type { TradeRow, TradesResponse } from "@/types/portfolio";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";

interface BuyLookupRow {
  symbol: string;
  price: string;
  createdAt: Date;
}

function findBuyPriceForSell(
  sell: { symbol: string; createdAt: Date },
  buysBySymbol: Map<string, BuyLookupRow[]>,
): number | null {
  const buys = buysBySymbol.get(sell.symbol) ?? [];
  let matched: BuyLookupRow | undefined;

  for (const buy of buys) {
    if (buy.createdAt < sell.createdAt) {
      matched = buy;
    }
  }

  return matched ? Number(matched.price) : null;
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

function toTradeRow(
  row: {
    id: number;
    symbol: string;
    side: string;
    qty: string;
    price: string;
    maxPriceAfterBuy: string | null;
    maxPriceAfterClose24h: string | null;
    minPriceAfterClose24h: string | null;
    maxPriceAfterClose24hPct: string | null;
    minPriceAfterClose24hPct: string | null;
    notional: string;
    interval: string;
    candleOpenTime: Date;
    reason: string;
    createdAt: Date;
  },
  {
    openPrice,
    closePrice,
    maxPriceAfterBuy,
    realizedPnlPct,
    postClose24h,
  }: {
    openPrice: string | null;
    closePrice: string | null;
    maxPriceAfterBuy: string | null;
    realizedPnlPct: number | null;
    postClose24h: TradePostClose24hMetrics;
  },
): TradeRow {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side as TradeRow["side"],
    qty: row.qty,
    price: row.price,
    openPrice,
    closePrice,
    maxPriceAfterBuy,
    notional: row.notional,
    interval: row.interval,
    candleOpenTime: row.candleOpenTime.toISOString(),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    realizedPnlPct,
    maxPriceAfterClose24h: postClose24h.maxPriceAfterClose24h,
    minPriceAfterClose24h: postClose24h.minPriceAfterClose24h,
    maxPriceAfterClose24hPct: postClose24h.maxPriceAfterClose24hPct,
    minPriceAfterClose24hPct: postClose24h.minPriceAfterClose24hPct,
  };
}

interface GetTradesParams {
  limit: number;
  offset: number;
}

export async function getTrades({
  limit,
  offset,
}: GetTradesParams): Promise<TradesResponse> {
  const rows = await getDb()
    .select()
    .from(trades)
    .orderBy(desc(trades.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(trades);

  const sellSymbols = [
    ...new Set(
      rows.filter((row) => row.side === "SELL").map((row) => row.symbol),
    ),
  ];
  const buysBySymbol = await loadBuysBySymbol(sellSymbols);

  return {
    total: countRow?.total ?? 0,
    trades: rows.map((row) => {
      if (row.side !== "SELL") {
        return toTradeRow(row, {
          openPrice: row.price,
          closePrice: null,
          maxPriceAfterBuy: row.maxPriceAfterBuy,
          realizedPnlPct: null,
          postClose24h: NULL_TRADE_POST_CLOSE_24H,
        });
      }

      const buyPrice = findBuyPriceForSell(row, buysBySymbol);
      const sellPrice = Number(row.price);
      const realizedPnlPct =
        buyPrice !== null && buyPrice !== 0 && Number.isFinite(sellPrice)
          ? pnlPercentFromPrices(buyPrice, sellPrice)
          : null;

      return toTradeRow(row, {
        openPrice: buyPrice !== null ? String(buyPrice) : null,
        closePrice: row.price,
        maxPriceAfterBuy: row.maxPriceAfterBuy,
        realizedPnlPct,
        postClose24h: mapPostClose24hFromDb(row),
      });
    }),
  };
}
