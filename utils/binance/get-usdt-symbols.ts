import { BINANCE_API_BASE_URL } from "@/constants/binance";
import type { BinanceExchangeInfoResponse } from "@/types/binance";

export async function getUsdtSymbols(): Promise<string[]> {
  const response = await fetch(`${BINANCE_API_BASE_URL}/api/v3/exchangeInfo`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch symbols from Binance");
  }

  const data = (await response.json()) as BinanceExchangeInfoResponse;

  return data.symbols
    .filter((item) => item.quoteAsset === "USDT" && item.status === "TRADING")
    .map((item) => item.symbol)
    .sort();
}
