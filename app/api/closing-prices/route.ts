import { NextResponse } from "next/server";

import {
  BINANCE_FETCH_CONCURRENCY,
  CANDLE_INTERVALS,
} from "@/constants/binance";
import type {
  CandleInterval,
  ClosingPricesResponse,
  SymbolClosingPrices,
} from "@/types/binance";
import { getClosingPrice } from "@/utils/binance/get-closing-price";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";
import { parseCandleIntervals } from "@/utils/binance/parse-candle-intervals";
import { processInBatches } from "@/utils/process-in-batches";

interface PriceTask {
  symbol: string;
  interval: CandleInterval;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const intervals = parseCandleIntervals(searchParams.get("intervals"));

  if (!intervals) {
    return NextResponse.json(
      {
        error: `Invalid intervals. Use comma-separated values from: ${CANDLE_INTERVALS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  let symbols: string[];

  try {
    symbols = await getUsdtSymbols();
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch symbols from Binance" },
      { status: 502 },
    );
  }

  const symbolsFilter = searchParams
    .get("symbols")
    ?.split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (symbolsFilter?.length) {
    const allowed = new Set(symbols);
    const invalid = symbolsFilter.filter((symbol) => !allowed.has(symbol));

    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown or inactive symbols: ${invalid.join(", ")}` },
        { status: 400 },
      );
    }

    symbols = symbolsFilter;
  }

  const tasks: PriceTask[] = symbols.flatMap((symbol) =>
    intervals.map((interval) => ({ symbol, interval })),
  );

  const results = await processInBatches({
    items: tasks,
    batchSize: BINANCE_FETCH_CONCURRENCY,
    processItem: async ({ symbol, interval }) => ({
      symbol,
      interval,
      close: await getClosingPrice({ symbol, interval }),
    }),
  });

  const pricesBySymbol = new Map<string, SymbolClosingPrices>();

  for (const symbol of symbols) {
    pricesBySymbol.set(symbol, { symbol, prices: {} });
  }

  for (const { symbol, interval, close } of results) {
    if (close === null) {
      continue;
    }

    pricesBySymbol.get(symbol)!.prices[interval] = close;
  }

  const response: ClosingPricesResponse = {
    intervals,
    updatedAt: new Date().toISOString(),
    data: symbols.map((symbol) => pricesBySymbol.get(symbol)!),
  };

  return NextResponse.json(response);
}
