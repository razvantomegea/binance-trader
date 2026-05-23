import type { CandleInterval } from "@/types/binance";
import { getKlines } from "@/utils/binance/get-klines";

interface GetKlinesResponseParams {
  symbol: string;
  interval: CandleInterval;
  limit: number;
}

export async function getKlinesResponse({
  symbol,
  interval,
  limit,
}: GetKlinesResponseParams) {
  const candles = await getKlines({ symbol, interval, limit });
  return { symbol, interval, candles };
}
