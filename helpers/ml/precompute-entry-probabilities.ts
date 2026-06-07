import * as tf from "@tensorflow/tfjs";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { MlModelMetadata } from "@/types/ml-strategy";
import type { KlineCandle } from "@/types/binance";
import { buildDecisionFeatures } from "@/utils/ml/build-decision-features";
import { normalizeFeatures } from "@/utils/ml/split-dataset-by-time";

export interface PrecomputeEntryProbabilitiesParams {
  symbols: string[];
  klinesBySymbol: Map<string, KlineCandle[]>;
  model: tf.LayersModel;
  metadata: MlModelMetadata;
}

function buildNormalizedRows(params: {
  klinesAsc: KlineCandle[];
  metadata: MlModelMetadata;
}): { openTimes: number[]; normalizedRows: number[][] } {
  const openTimes: number[] = [];
  const normalizedRows: number[][] = [];

  for (
    let index = STRATEGY_LOOKBACK_CLOSES - 1;
    index < params.klinesAsc.length;
    index += 1
  ) {
    const windowAsc = params.klinesAsc.slice(
      index - STRATEGY_LOOKBACK_CLOSES + 1,
      index + 1,
    );
    const closed = [...windowAsc].reverse();
    const { features } = buildDecisionFeatures({ closed });
    openTimes.push(params.klinesAsc[index]!.openTime);
    normalizedRows.push(
      normalizeFeatures(features, params.metadata.normalization),
    );
  }

  return { openTimes, normalizedRows };
}

async function predictByOpenTime(params: {
  model: tf.LayersModel;
  openTimes: number[];
  normalizedRows: number[][];
}): Promise<Map<number, number>> {
  const input = tf.tensor2d(params.normalizedRows);
  const output = params.model.predict(input) as tf.Tensor;
  const probabilities = await output.data();
  const byOpenTime = new Map<number, number>();

  for (let index = 0; index < params.openTimes.length; index += 1) {
    byOpenTime.set(params.openTimes[index]!, probabilities[index] ?? 0);
  }

  input.dispose();
  output.dispose();
  return byOpenTime;
}

export async function precomputeEntryProbabilities(
  params: PrecomputeEntryProbabilitiesParams,
): Promise<Map<string, Map<number, number>>> {
  const result = new Map<string, Map<number, number>>();

  for (const symbol of params.symbols) {
    const klinesAsc = params.klinesBySymbol.get(symbol);
    if (!klinesAsc || klinesAsc.length < STRATEGY_LOOKBACK_CLOSES) {
      continue;
    }

    const { openTimes, normalizedRows } = buildNormalizedRows({
      klinesAsc,
      metadata: params.metadata,
    });

    if (normalizedRows.length === 0) {
      continue;
    }

    const byOpenTime = await predictByOpenTime({
      model: params.model,
      openTimes,
      normalizedRows,
    });
    result.set(symbol, byOpenTime);
  }

  return result;
}
