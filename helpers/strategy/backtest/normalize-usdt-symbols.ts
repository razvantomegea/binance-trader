export function normalizeAndValidateUsdtSymbols(symbols: string[]): string[] {
  const normalized = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length > 0 && normalized.length === 0) {
    throw new Error(
      "config.symbols must include at least one non-empty USDT symbol.",
    );
  }

  if (normalized.includes("USDT")) {
    throw new Error(
      'Invalid symbol "USDT" in config.symbols. Use market pairs like BTCUSDT.',
    );
  }

  const invalid = normalized.filter((symbol) => !symbol.endsWith("USDT"));
  if (invalid.length > 0) {
    throw new Error(
      `Only USDT symbols are allowed. Invalid: ${invalid.join(", ")}`,
    );
  }

  const deduped = [...new Set(normalized)].sort();
  if (deduped.length === 0) {
    throw new Error(
      "runBacktest requires at least one valid USDT symbol after normalization.",
    );
  }

  return deduped;
}
