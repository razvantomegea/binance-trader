import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as BuildForwardLabelModule from "@/utils/ml/build-forward-label";

type BuildForwardLabelExports = typeof BuildForwardLabelModule;

vi.mock("@/utils/ml/build-forward-label", async (importOriginal) => {
  const actual = await importOriginal<BuildForwardLabelExports>();
  return {
    ...actual,
    buildForwardLabel: vi.fn(actual.buildForwardLabel),
  };
});

import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

import { buildForwardLabel } from "@/utils/ml/build-forward-label";

import { generateDatasetRowsForSymbol } from "./generate-dataset-rows";

const mockedBuildForwardLabel = vi.mocked(buildForwardLabel);

function makeKlines(closes: number[]): KlineCandle[] {
  return closes.map((close, index) => ({
    openTime: index * HOUR_MS,
    open: close,
    high: close + 5,
    low: close - 2,
    close,
  }));
}

describe("generateDatasetRowsForSymbol", () => {
  beforeEach(async () => {
    const actual = await vi.importActual<BuildForwardLabelExports>(
      "@/utils/ml/build-forward-label",
    );
    mockedBuildForwardLabel.mockImplementation(actual.buildForwardLabel);
  });

  it("returns empty rows when range is too short", () => {
    const klinesAsc = makeKlines(Array.from({ length: 10 }, () => 100));

    const rows = generateDatasetRowsForSymbol({
      symbol: "BTCUSDT",
      klinesAsc,
      startTime: 0,
      endTime: 5 * HOUR_MS,
      feeBps: 0,
    });

    expect(rows).toEqual([]);
  });

  it("skips samples that are not entry-band candidates", () => {
    const length = 72;
    const klinesAsc = makeKlines(Array.from({ length }, () => 100));

    const rows = generateDatasetRowsForSymbol({
      symbol: "BTCUSDT",
      klinesAsc,
      startTime: 24 * HOUR_MS,
      endTime: (length - 25) * HOUR_MS,
      feeBps: 0,
    });

    expect(rows).toEqual([]);
  });

  it("skips sample times before a closed lookback window exists", () => {
    const klinesAsc = makeKlines(Array.from({ length: 30 }, (_, i) => 100 + i));

    const rows = generateDatasetRowsForSymbol({
      symbol: "BTCUSDT",
      klinesAsc,
      startTime: 0,
      endTime: 2 * HOUR_MS,
      feeBps: 0,
    });

    expect(rows).toEqual([]);
  });

  it("skips samples when forward label cannot be built", () => {
    const length = 72;
    const closes = Array.from({ length }, (_, i) =>
      i < 24 ? 100 : i < 36 ? 160 : 240,
    );
    const klinesAsc = makeKlines(closes);
    mockedBuildForwardLabel.mockReturnValue(null);

    const rows = generateDatasetRowsForSymbol({
      symbol: "BTCUSDT",
      klinesAsc,
      startTime: 24 * HOUR_MS,
      endTime: (length - 25) * HOUR_MS,
      feeBps: 0,
    });

    expect(rows).toEqual([]);
  });

  it("generates labeled rows for entry-band candidates", () => {
    const length = 72;
    const closes = Array.from({ length }, (_, i) =>
      i < 24 ? 100 : i < 36 ? 160 : 240,
    );
    const klinesAsc = makeKlines(closes);

    const rows = generateDatasetRowsForSymbol({
      symbol: "BTCUSDT",
      klinesAsc,
      startTime: 24 * HOUR_MS,
      endTime: (length - 25) * HOUR_MS,
      feeBps: 0,
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.symbol).toBe("BTCUSDT");
      expect(row.featureNames.length).toBeGreaterThan(0);
      expect(row.features).toHaveLength(row.featureNames.length);
      expect([0, 1]).toContain(row.label);
      expect(row.labelMeta.horizonHours).toBe(24);
    }
  });
});
