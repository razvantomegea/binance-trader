export interface TrailingStopPosition {
  buyPrice: number;
  maxPriceAfterBuy: number | null;
}

export function getTrailingReferencePrice(
  position: TrailingStopPosition,
): number {
  const peak = position.maxPriceAfterBuy ?? position.buyPrice;
  return Math.max(position.buyPrice, peak);
}

export function getTrailingStopPrice(params: {
  trailingRef: number;
  thresholdPct: number;
}): number {
  return params.trailingRef * (1 - params.thresholdPct);
}

export function getMaxLossFloorPrice(params: {
  buyPrice: number;
  thresholdPct: number;
}): number {
  return params.buyPrice * (1 - params.thresholdPct);
}

export function getTrailingExitPrice(params: {
  position: TrailingStopPosition;
  thresholdPct: number;
}): number {
  const trailingRef = getTrailingReferencePrice(params.position);
  const stopPrice = getTrailingStopPrice({
    trailingRef,
    thresholdPct: params.thresholdPct,
  });
  const floorPrice = getMaxLossFloorPrice({
    buyPrice: params.position.buyPrice,
    thresholdPct: params.thresholdPct,
  });
  return Math.max(stopPrice, floorPrice);
}

export function getWorstObservedPrice(params: {
  low: number;
  markPrice?: number;
}): number {
  const mark = params.markPrice ?? params.low;
  return Math.min(params.low, mark);
}

export function getUpdatedPeakPrice(params: {
  currentMax: number;
  high: number;
  close: number;
  markPrice?: number;
}): number {
  const mark = params.markPrice ?? params.close;
  return Math.max(params.currentMax, params.high, params.close, mark);
}

export function shouldTriggerTrailingStop(params: {
  position: TrailingStopPosition;
  worstPrice: number;
  thresholdPct: number;
}): boolean {
  const exitPrice = getTrailingExitPrice({
    position: params.position,
    thresholdPct: params.thresholdPct,
  });
  return params.worstPrice <= exitPrice;
}

export function resolveTrailingSellPrice(params: {
  position: TrailingStopPosition;
  marketPrice: number;
  thresholdPct: number;
}): number {
  const exitPrice = getTrailingExitPrice({
    position: params.position,
    thresholdPct: params.thresholdPct,
  });
  return params.marketPrice >= exitPrice ? params.marketPrice : exitPrice;
}
