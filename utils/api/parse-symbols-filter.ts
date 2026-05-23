export function parseSymbolsFilter(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const symbols = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return symbols.length > 0 ? symbols : undefined;
}
