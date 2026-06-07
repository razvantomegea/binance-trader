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

export async function precomputeEntryProbabilities(
  params: PrecomputeEntryProbabilitiesParams,
): Promise<Map<string, Map<number, number>>> {
  const result = new Map<string, Map<number, number>>();

  for (const symbol of params.symbols) {
    const klinesAsc = params.klinesBySymbol.get(symbol);
    if (!klinesAsc || klinesAsc.length < STRATEGY_LOOKBACK_CLOSES) {
      continue;
    }

    const openTimes: number[] = [];
    const normalizedRows: number[][] = [];

    for (let j = STRATEGY_LOOKBACK_CLOSES - 1; j < klinesAsc.length; j += 1) {
      const windowAsc = klinesAsc.slice(
        j - STRATEGY_LOOKBACK_CLOSES + 1,
        j + 1,
      );
      const closed = [...windowAsc].reverse();
      const { features } = buildDecisionFeatures({ closed });

      openTimes.push(klinesAsc[j]!.openTime);
      normalizedRows.push(
        normalizeFeatures(features, params.metadata.normalization),
      );
    }

    if (normalizedRows.length === 0) {
      continue;
    }

    const input = tf.tensor2d(normalizedRows);
    const output = params.model.predict(input) as tf.Tensor;
    const probabilities = await output.data();

    const byOpenTime = new Map<number, number>();
    for (let i = 0; i < openTimes.length; i += 1) {
      byOpenTime.set(openTimes[i]!, probabilities[i] ?? 0);
    }

    result.set(symbol, byOpenTime);
    input.dispose();
    output.dispose();
  }

  return result;
}
