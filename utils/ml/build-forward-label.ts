import {
  ML_FORWARD_DRAWDOWN_CAP_PCT,
  ML_FORWARD_HORIZON_HOURS,
} from "@/constants/ml-strategy";
import type { KlineCandle } from "@/types/binance";
import type { MlHorizonHours, MlLabelMeta } from "@/types/ml-strategy";
import { HOUR_MS } from "@/utils/binance/candle-time";
import { safePct } from "@/utils/ml/safe-number";

export interface BuildForwardLabelParams {
  klinesAsc: KlineCandle[];
  entryCandleIndex: number;
  entryPrice: number;
  horizonHours?: MlHorizonHours;
  forwardDrawdownCapPct?: number;
  feeBps?: number;
}

export interface BuildForwardLabelResult {
  label: 0 | 1;
  labelMeta: MlLabelMeta;
}

export function buildForwardLabel({
  klinesAsc,
  entryCandleIndex,
  entryPrice,
  horizonHours = ML_FORWARD_HORIZON_HOURS,
  forwardDrawdownCapPct = ML_FORWARD_DRAWDOWN_CAP_PCT,
  feeBps = 0,
}: BuildForwardLabelParams): BuildForwardLabelResult | null {
  if (
    entryCandleIndex < 0 ||
    entryCandleIndex >= klinesAsc.length ||
    !Number.isFinite(entryPrice) ||
    entryPrice <= 0
  ) {
    return null;
  }

  const future = klinesAsc.slice(
    entryCandleIndex + 1,
    entryCandleIndex + 1 + horizonHours,
  );

  if (future.length === 0) {
    return null;
  }

  let peak = entryPrice;
  let trough = entryPrice;
  let finalClose = entryPrice;

  for (const candle of future) {
    if (candle.high > peak) {
      peak = candle.high;
    }
    if (candle.low < trough) {
      trough = candle.low;
    }
    finalClose = candle.close;
  }

  const roundTripFeePct = (feeBps * 2) / 100;
  const forwardReturnPct =
    safePct(finalClose - entryPrice, entryPrice) - roundTripFeePct;
  const forwardMaxDrawdownPct = safePct(entryPrice - trough, entryPrice);

  const label: 0 | 1 =
    forwardReturnPct > 0 && forwardMaxDrawdownPct <= forwardDrawdownCapPct * 100
      ? 1
      : 0;

  return {
    label,
    labelMeta: {
      forwardReturnPct,
      forwardMaxDrawdownPct,
      horizonHours,
    },
  };
}

export function findClosedCandleIndexBeforeTime(params: {
  klinesAsc: KlineCandle[];
  targetTime: number;
}): number {
  for (let i = params.klinesAsc.length - 1; i >= 0; i -= 1) {
    if (params.klinesAsc[i]!.openTime + HOUR_MS <= params.targetTime) {
      return i;
    }
  }
  return -1;
}

export function buildHourlySampleTimes(params: {
  startTime: number;
  endTime: number;
  sampleEveryHours: number;
}): number[] {
  const stepMs = params.sampleEveryHours * HOUR_MS;
  const times: number[] = [];
  for (let t = params.startTime; t <= params.endTime; t += stepMs) {
    times.push(t);
  }
  return times;
}
