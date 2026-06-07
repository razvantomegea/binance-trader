import { describe, expect, it } from "vitest";

import type { MlDecisionRow } from "@/types/ml-strategy";

import {
  fitFeatureNormalization,
  normalizeFeatures,
  splitRowsByTime,
} from "./split-dataset-by-time";

function makeRow(params: {
  symbol: string;
  openTime: number;
  features?: number[];
}): MlDecisionRow {
  return {
    symbol: params.symbol,
    openTime: params.openTime,
    featureNames: ["f1", "f2"],
    features: params.features ?? [1, 2],
    label: 1,
    labelMeta: {
      forwardReturnPct: 1,
      forwardMaxDrawdownPct: 0.5,
      horizonHours: 24,
    },
  };
}

describe("fitFeatureNormalization", () => {
  it("uses std of 1 when a feature has zero variance", () => {
    const normalization = fitFeatureNormalization([
      makeRow({ symbol: "A", openTime: 1, features: [5, 10] }),
      makeRow({ symbol: "B", openTime: 2, features: [5, 12] }),
    ]);

    expect(normalization.stds[0]).toBe(1);
    expect(normalizeFeatures([5, 11], normalization)[0]).toBe(0);
  });
});

describe("splitRowsByTime", () => {
  it("returns empty splits for empty input", () => {
    const result = splitRowsByTime([]);
    expect(result.train).toEqual([]);
    expect(result.validation).toEqual([]);
    expect(result.test).toEqual([]);
    expect(result.split).toEqual({
      trainEndOpenTime: 0,
      validationEndOpenTime: 0,
    });
  });

  it("handles a single unique open time", () => {
    const rows = [makeRow({ symbol: "A", openTime: 1000 })];

    const { train, validation, test, split } = splitRowsByTime(rows);

    expect(train).toHaveLength(1);
    expect(validation).toHaveLength(0);
    expect(test).toHaveLength(0);
    expect(split.trainEndOpenTime).toBe(1000);
    expect(split.validationEndOpenTime).toBe(1000);
  });

  it("partitions rows by unique open times", () => {
    const rows = [
      makeRow({ symbol: "A", openTime: 1000 }),
      makeRow({ symbol: "B", openTime: 1000 }),
      makeRow({ symbol: "A", openTime: 2000 }),
      makeRow({ symbol: "B", openTime: 3000 }),
      makeRow({ symbol: "A", openTime: 4000 }),
      makeRow({ symbol: "B", openTime: 5000 }),
    ];

    const { train, validation, test, split } = splitRowsByTime(rows);

    expect(train.every((row) => row.openTime <= split.trainEndOpenTime)).toBe(
      true,
    );
    expect(
      validation.every(
        (row) =>
          row.openTime > split.trainEndOpenTime &&
          row.openTime <= split.validationEndOpenTime,
      ),
    ).toBe(true);
    expect(
      test.every((row) => row.openTime > split.validationEndOpenTime),
    ).toBe(true);
    expect(train.length + validation.length + test.length).toBe(rows.length);
  });
});

describe("fitFeatureNormalization", () => {
  it("throws when dataset is empty", () => {
    expect(() => fitFeatureNormalization([])).toThrow(
      "Cannot fit normalization on empty dataset.",
    );
  });

  it("computes means and stds for features", () => {
    const rows = [
      makeRow({ symbol: "A", openTime: 1, features: [0, 0] }),
      makeRow({ symbol: "B", openTime: 2, features: [2, 4] }),
    ];

    const normalization = fitFeatureNormalization(rows);

    expect(normalization.means).toEqual([1, 2]);
    expect(normalization.stds[0]).toBeGreaterThan(0);
    expect(normalization.stds[1]).toBeGreaterThan(0);
  });
});

describe("normalizeFeatures", () => {
  it("z-scores features using normalization stats", () => {
    const normalized = normalizeFeatures([3, 5], {
      featureNames: ["f1", "f2"],
      means: [1, 1],
      stds: [2, 2],
    });

    expect(normalized).toEqual([1, 2]);
  });
});
