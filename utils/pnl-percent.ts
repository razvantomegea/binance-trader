export function pnlPercentFromPrices(
  buyPrice: number,
  currentOrSellPrice: number,
): number {
  return ((currentOrSellPrice - buyPrice) / buyPrice) * 100;
}
