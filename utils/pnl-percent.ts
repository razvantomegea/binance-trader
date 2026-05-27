export function pnlPercentFromPrices(
  buyPrice: number,
  currentOrSellPrice: number,
): number | null {
  if (buyPrice === 0 || !Number.isFinite(buyPrice)) {
    return null;
  }
  return ((currentOrSellPrice - buyPrice) / buyPrice) * 100;
}
