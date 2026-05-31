import { isUsdtSymbol } from "@/utils/binance/is-usdt-symbol";

export function parseSymbolsFilter(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const symbols = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const invalid = symbols.filter((symbol) => !isUsdtSymbol(symbol));
  if (invalid.length > 0) {
    throw new Error(
      `Only symbols ending with USDT are allowed. Invalid: ${invalid.join(", ")}`,
    );
  }

  return symbols.length > 0 ? symbols : undefined;
}
