import {
  ML_TRAIN_FRACTION,
  ML_VALIDATION_FRACTION,
} from "@/constants/ml-strategy";
import type { MlDecisionRow, MlTimeSplit } from "@/types/ml-strategy";
import type { MlFeatureNormalization } from "@/types/ml-strategy";

export function splitRowsByTime(rows: MlDecisionRow[]): {
  train: MlDecisionRow[];
  validation: MlDecisionRow[];
  test: MlDecisionRow[];
  split: MlTimeSplit;
} {
  const sorted = [...rows].sort(
    (a, b) => a.openTime - b.openTime || a.symbol.localeCompare(b.symbol),
  );
  if (sorted.length === 0) {
    return {
      train: [],
      validation: [],
      test: [],
      split: { trainEndOpenTime: 0, validationEndOpenTime: 0 },
    };
  }

  const uniqueOpenTimes = [...new Set(sorted.map((row) => row.openTime))].sort(
    (a, b) => a - b,
  );

  const trainTimestampCount = Math.max(
    1,
    Math.floor(uniqueOpenTimes.length * ML_TRAIN_FRACTION),
  );
  const validationTimestampCount = Math.max(
    1,
    Math.floor(uniqueOpenTimes.length * ML_VALIDATION_FRACTION),
  );

  const trainEndOpenTime =
    uniqueOpenTimes[trainTimestampCount - 1] ?? uniqueOpenTimes[0]!;
  const validationEndOpenTime =
    uniqueOpenTimes[trainTimestampCount + validationTimestampCount - 1] ??
    trainEndOpenTime;

  const train = sorted.filter((row) => row.openTime <= trainEndOpenTime);
  const validation = sorted.filter(
    (row) =>
      row.openTime > trainEndOpenTime && row.openTime <= validationEndOpenTime,
  );
  const test = sorted.filter((row) => row.openTime > validationEndOpenTime);

  return {
    train,
    validation,
    test,
    split: { trainEndOpenTime, validationEndOpenTime },
  };
}

export function fitFeatureNormalization(
  rows: MlDecisionRow[],
): MlFeatureNormalization {
  if (rows.length === 0) {
    throw new Error("Cannot fit normalization on empty dataset.");
  }

  const featureCount = rows[0]!.features.length;
  const { featureNames } = rows[0]!;
  const means = Array.from({ length: featureCount }, () => 0);
  const stds = Array.from({ length: featureCount }, () => 0);

  for (const row of rows) {
    for (let i = 0; i < featureCount; i += 1) {
      means[i]! += row.features[i]!;
    }
  }

  for (let i = 0; i < featureCount; i += 1) {
    means[i]! /= rows.length;
  }

  for (const row of rows) {
    for (let i = 0; i < featureCount; i += 1) {
      const delta = row.features[i]! - means[i]!;
      stds[i]! += delta * delta;
    }
  }

  for (let i = 0; i < featureCount; i += 1) {
    const variance = stds[i]! / rows.length;
    stds[i] = Math.sqrt(variance) || 1;
  }

  return { featureNames, means, stds };
}

export function normalizeFeatures(
  features: number[],
  normalization: MlFeatureNormalization,
): number[] {
  return features.map(
    (value, index) =>
      (value - normalization.means[index]!) / normalization.stds[index]!,
  );
}
