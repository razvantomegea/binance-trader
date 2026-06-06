import {
  BINANCE_API_BASE_URL,
  BINANCE_KLINE_INTERVAL,
  KLINE_REVALIDATE_SECONDS,
} from "@/constants/binance";
import type { BinanceKline, CandleInterval } from "@/types/binance";

interface GetClosingPriceParams {
  symbol: string;
  interval: CandleInterval;
}

export async function getClosingPrice({
  symbol,
  interval: _interval,
}: GetClosingPriceParams): Promise<string | null> {
  const url = new URL(`${BINANCE_API_BASE_URL}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", BINANCE_KLINE_INTERVAL);
  url.searchParams.set("limit", "2");

  const response = await fetch(url, {
    next: { revalidate: KLINE_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return null;
  }

  const klines = (await response.json()) as BinanceKline[];

  if (klines.length === 0) {
    return null;
  }

  return klines[0]![4];
}
