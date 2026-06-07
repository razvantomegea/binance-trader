import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import { isEntryBandCandidate } from "@/helpers/strategy/decision-core";
import { getClosedWindowAt } from "@/helpers/strategy/backtest/historical-kline-provider";
import type { MlDecisionRow } from "@/types/ml-strategy";
import type { KlineCandle } from "@/types/binance";
import { buildDecisionFeatures } from "@/utils/ml/build-decision-features";
import {
  buildForwardLabel,
  buildHourlySampleTimes,
  findClosedCandleIndexBeforeTime,
} from "@/utils/ml/build-forward-label";
import {
  ML_DATASET_SAMPLE_EVERY_HOURS,
  ML_FORWARD_HORIZON_HOURS,
} from "@/constants/ml-strategy";

export interface GenerateDatasetRowsParams {
  symbol: string;
  klinesAsc: KlineCandle[];
  startTime: number;
  endTime: number;
  feeBps: number;
}

export function generateDatasetRowsForSymbol(
  params: GenerateDatasetRowsParams,
): MlDecisionRow[] {
  const rows: MlDecisionRow[] = [];
  const sampleTimes = buildHourlySampleTimes({
    startTime: params.startTime,
    endTime: params.endTime,
    sampleEveryHours: ML_DATASET_SAMPLE_EVERY_HOURS,
  });

  for (const openTime of sampleTimes) {
    const closed = getClosedWindowAt({
      klinesAsc: params.klinesAsc,
      targetTime: openTime,
      count: STRATEGY_LOOKBACK_CLOSES,
    });

    if (!closed) {
      continue;
    }

    if (!isEntryBandCandidate({ closed })) {
      continue;
    }

    const entryIndex = findClosedCandleIndexBeforeTime({
      klinesAsc: params.klinesAsc,
      targetTime: openTime,
    });

    if (entryIndex < 0) {
      continue;
    }

    const entryPrice = params.klinesAsc[entryIndex]!.close;
    const labelResult = buildForwardLabel({
      klinesAsc: params.klinesAsc,
      entryCandleIndex: entryIndex,
      entryPrice,
      horizonHours: ML_FORWARD_HORIZON_HOURS,
      feeBps: params.feeBps,
    });

    if (!labelResult) {
      continue;
    }

    const { featureNames, features } = buildDecisionFeatures({ closed });

    rows.push({
      symbol: params.symbol,
      openTime,
      featureNames,
      features,
      label: labelResult.label,
      labelMeta: labelResult.labelMeta,
    });
  }

  return rows;
}
