import {
  get24hHighLow,
  getCloseHighLow,
  type CandleSlice,
} from "@/helpers/strategy/decision-core";
import { DEFAULT_STRATEGY_PARAMS } from "@/constants/strategy-params";
import type { StrategyParams } from "@/types/strategy-params";
import { isGainWithinBand } from "@/utils/strategy/price-change-conditions";
import { safeRatio } from "@/utils/ml/safe-number";

const ML_FEATURE_NAMES = [
  "closeGainVsLowClose",
  "highCloseGainVsLowClose",
  "closeInEntryBand",
  "highCloseInEntryBand",
  "closePositionIn24hRange",
  "avgCandleRangePct",
  "closeReturnVolatility",
  "latestCloseReturn",
  "lookbackMaxDrawdownPct",
  "upCandleRatio",
  "hourOfDayNorm",
  "closeVsMeanClose",
] as const;

export type MlFeatureName = (typeof ML_FEATURE_NAMES)[number];

export interface BuildDecisionFeaturesParams {
  closed: CandleSlice[];
  strategyParams?: StrategyParams;
}

export interface BuildDecisionFeaturesResult {
  featureNames: MlFeatureName[];
  features: number[];
}

function computeCloseReturns(closedAsc: CandleSlice[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closedAsc.length; i += 1) {
    const prev = closedAsc[i - 1]!.close;
    const current = closedAsc[i]!.close;
    returns.push(safeRatio(current - prev, prev));
  }
  return returns;
}

function computeStd(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function computeLookbackMaxDrawdownPct(closedAsc: CandleSlice[]): number {
  let peak = closedAsc[0]!.close;
  let maxDrawdown = 0;

  for (const candle of closedAsc) {
    if (candle.close > peak) {
      peak = candle.close;
    }
    const drawdown = safeRatio(peak - candle.close, peak);
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

function computeEntryBandFeatures(params: {
  latestClose: number;
  highClose: number;
  lowClose: number;
  strategyParams: StrategyParams;
}) {
  const closeInEntryBand = isGainWithinBand({
    value: params.latestClose,
    ref: params.lowClose,
    minPct: params.strategyParams.entryRangePct,
    maxPct: params.strategyParams.entryRangeMaxPct,
  })
    ? 1
    : 0;
  const highCloseInEntryBand = isGainWithinBand({
    value: params.highClose,
    ref: params.lowClose,
    minPct: params.strategyParams.entryRangePct,
    maxPct: params.strategyParams.entryRangeMaxPct,
  })
    ? 1
    : 0;
  return { closeInEntryBand, highCloseInEntryBand };
}

function computeAverageRangePct(closed: CandleSlice[]): number {
  return (
    closed.reduce(
      (sum, candle) => sum + safeRatio(candle.high - candle.low, candle.close),
      0,
    ) / closed.length
  );
}

function computeUpCandleRatio(closed: CandleSlice[]): number {
  const upCandleCount = closed.filter((candle, index) => {
    if (index === closed.length - 1) {
      return false;
    }
    return candle.close > closed[index + 1]!.close;
  }).length;
  return upCandleCount / Math.max(closed.length - 1, 1);
}

function computeCloseVsMeanClose(
  closed: CandleSlice[],
  latestClose: number,
): number {
  const meanClose =
    closed.reduce((sum, candle) => sum + candle.close, 0) / closed.length;
  return safeRatio(latestClose - meanClose, meanClose);
}

export function buildDecisionFeatures({
  closed,
  strategyParams = DEFAULT_STRATEGY_PARAMS,
}: BuildDecisionFeaturesParams): BuildDecisionFeaturesResult {
  if (closed.length === 0) {
    return {
      featureNames: [...ML_FEATURE_NAMES],
      features: ML_FEATURE_NAMES.map(() => 0),
    };
  }

  const closedAsc = [...closed].reverse();
  const latest = closed[0]!;
  const { highClose, lowClose } = getCloseHighLow(closed);
  const { high24h, low24h } = get24hHighLow(closed);

  const closeGainVsLowClose = safeRatio(latest.close - lowClose, lowClose);
  const highCloseGainVsLowClose = safeRatio(highClose - lowClose, lowClose);

  const { closeInEntryBand, highCloseInEntryBand } = computeEntryBandFeatures({
    latestClose: latest.close,
    highClose,
    lowClose,
    strategyParams,
  });

  const range24h = high24h - low24h;
  const closePositionIn24hRange =
    range24h > 0 ? (latest.close - low24h) / range24h : 0.5;

  const avgCandleRangePct = computeAverageRangePct(closed);

  const closeReturns = computeCloseReturns(closedAsc);
  const closeReturnVolatility = computeStd(closeReturns);

  const latestCloseReturn =
    closeReturns.length > 0 ? closeReturns[closeReturns.length - 1]! : 0;

  const lookbackMaxDrawdownPct = computeLookbackMaxDrawdownPct(closedAsc);

  const upCandleRatio = computeUpCandleRatio(closed);

  const hourOfDayNorm = new Date(latest.openTime).getUTCHours() / 23;
  const closeVsMeanClose = computeCloseVsMeanClose(closed, latest.close);

  return {
    featureNames: [...ML_FEATURE_NAMES],
    features: [
      closeGainVsLowClose,
      highCloseGainVsLowClose,
      closeInEntryBand,
      highCloseInEntryBand,
      closePositionIn24hRange,
      avgCandleRangePct,
      closeReturnVolatility,
      latestCloseReturn,
      lookbackMaxDrawdownPct,
      upCandleRatio,
      hourOfDayNorm,
      closeVsMeanClose,
    ],
  };
}
