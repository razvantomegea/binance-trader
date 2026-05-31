import { BINANCE_FETCH_CONCURRENCY } from "@/constants/binance";
import type {
  CandleInterval,
  ClosingPricesResponse,
  SymbolClosingPrices,
} from "@/types/binance";
import { getClosingPrice } from "@/utils/binance/get-closing-price";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";
import { processInBatches } from "@/utils/process-in-batches";

import { InvalidSymbolsError } from "./invalid-symbols-error";

interface PriceTask {
  symbol: string;
  interval: CandleInterval;
}

interface GetClosingPricesParams {
  intervals: CandleInterval[];
  symbolsFilter?: string[];
}

export async function getClosingPrices({
  intervals,
  symbolsFilter,
}: GetClosingPricesParams): Promise<ClosingPricesResponse> {
  let symbols = (await getUsdtSymbols()).filter(isUsdtSymbol);

  if (symbolsFilter?.length) {
    const allowed = new Set(symbols);
    const invalid = symbolsFilter.filter(
      (symbol) => !isUsdtSymbol(symbol) || !allowed.has(symbol),
    );

    if (invalid.length > 0) {
      throw new InvalidSymbolsError(invalid);
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

  return {
    intervals,
    updatedAt: new Date().toISOString(),
    data: symbols.map((symbol) => pricesBySymbol.get(symbol)!),
  };
}
