import { describe, expect, it } from "vitest";

import { computePeakWhilePositionOpen } from "./peak-while-open";

const HOUR_MS = 3_600_000;

describe("computePeakWhilePositionOpen", () => {
  it("returns buyPrice when no klines fall in the open window", () => {
    const buyOpenTime = 10 * HOUR_MS;

    expect(
      computePeakWhilePositionOpen({
        buyPrice: 100,
        buyOpenTime,
        klines: [{ openTime: buyOpenTime - HOUR_MS, high: 200, close: 190 }],
      }),
    ).toBe(100);
  });

  it("tracks peak across klines after buy until sell", () => {
    const buyOpenTime = 10 * HOUR_MS;
    const sellOpenTime = 12 * HOUR_MS;

    expect(
      computePeakWhilePositionOpen({
        buyPrice: 100,
        buyOpenTime,
        sellOpenTime,
        klines: [
          { openTime: buyOpenTime, high: 110, close: 105 },
          { openTime: buyOpenTime + HOUR_MS, high: 130, close: 125 },
          { openTime: sellOpenTime, high: 140, close: 135 },
          { openTime: sellOpenTime + HOUR_MS, high: 200, close: 195 },
        ],
      }),
    ).toBe(140);
  });

  it("includes all post-buy klines when sellOpenTime is undefined", () => {
    const buyOpenTime = 10 * HOUR_MS;

    expect(
      computePeakWhilePositionOpen({
        buyPrice: 100,
        buyOpenTime,
        klines: [
          { openTime: buyOpenTime, high: 110, close: 108 },
          { openTime: buyOpenTime + HOUR_MS, high: 150, close: 145 },
        ],
      }),
    ).toBe(150);
  });

  it("uses close and high when updating peak", () => {
    const buyOpenTime = 10 * HOUR_MS;

    expect(
      computePeakWhilePositionOpen({
        buyPrice: 100,
        buyOpenTime,
        klines: [{ openTime: buyOpenTime, high: 105, close: 120 }],
      }),
    ).toBe(120);
  });
});
