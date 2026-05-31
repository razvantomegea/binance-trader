export function isUsdtSymbol(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return (
    normalized.length > 4 &&
    normalized !== "USDT" &&
    normalized.endsWith("USDT")
  );
}
