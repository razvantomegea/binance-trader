import { BINANCE_API_BASE_URL } from "@/constants/binance";
import type { BinanceExchangeInfoResponse } from "@/types/binance";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";

async function getExchangeSymbols(): Promise<
  BinanceExchangeInfoResponse["symbols"]
> {
  const response = await fetch(`${BINANCE_API_BASE_URL}/api/v3/exchangeInfo`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch symbols from Binance");
  }

  const data = (await response.json()) as BinanceExchangeInfoResponse;
  return data.symbols;
}

export async function getTradingSymbols(): Promise<string[]> {
  return getUsdtSymbols();
}

export async function getUsdtSymbols(): Promise<string[]> {
  const symbols = await getExchangeSymbols();

  return symbols
    .filter(
      (item) =>
        item.quoteAsset === "USDT" &&
        item.status === "TRADING" &&
        isUsdtSymbol(item.symbol),
    )
    .map((item) => item.symbol)
    .sort();
}
