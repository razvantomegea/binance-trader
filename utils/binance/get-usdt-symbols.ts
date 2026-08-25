import { BINANCE_API_BASE_URL } from "@/constants/binance";
import type { BinanceExchangeInfoResponse } from "@/types/binance";
import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";

const USDT_SYMBOLS_CACHE_TTL_MS = 60 * 60 * 1000;

interface UsdtSymbolsCache {
  symbols: string[];
  fetchedAtMs: number;
}

let usdtSymbolsCache: UsdtSymbolsCache | null = null;

export function resetUsdtSymbolsCacheForTests(): void {
  usdtSymbolsCache = null;
}

async function getExchangeSymbols(): Promise<
  BinanceExchangeInfoResponse["symbols"]
> {
  const url = new URL(`${BINANCE_API_BASE_URL}/api/v3/exchangeInfo`);
  url.searchParams.set("permissions", "SPOT");
  url.searchParams.set("symbolStatus", "TRADING");
  url.searchParams.set("showPermissionSets", "false");

  // Next.js data cache rejects bodies over 2MB; full exchangeInfo is ~23MB.
  const response = await fetch(url.toString(), {
    cache: "no-store",
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
  const now = Date.now();
  if (
    usdtSymbolsCache &&
    now - usdtSymbolsCache.fetchedAtMs < USDT_SYMBOLS_CACHE_TTL_MS
  ) {
    return usdtSymbolsCache.symbols;
  }

  const symbols = await getExchangeSymbols();
  const filtered = symbols
    .filter(
      (item) =>
        item.quoteAsset === "USDT" &&
        item.status === "TRADING" &&
        isUsdtSymbol(item.symbol),
    )
    .map((item) => item.symbol)
    .sort();

  usdtSymbolsCache = { symbols: filtered, fetchedAtMs: now };
  return filtered;
}
