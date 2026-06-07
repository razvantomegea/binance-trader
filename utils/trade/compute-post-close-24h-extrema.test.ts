import { describe, expect, it } from "vitest";

import { HOUR_MS } from "@/utils/binance/candle-time";
import {
  buildKlineOpenTimeIndex,
  computePostClose24hExtrema,
} from "@/utils/trade/compute-post-close-24h-extrema";

describe("computePostClose24hExtrema", () => {
  const sellOpenTime = 10 * HOUR_MS;
  const klinesAsc = [
    { openTime: 8 * HOUR_MS, open: 100, high: 100, low: 100, close: 100 },
    { openTime: 9 * HOUR_MS, open: 100, high: 100, low: 100, close: 100 },
    { openTime: sellOpenTime, open: 100, high: 110, low: 90, close: 100 },
    { openTime: 11 * HOUR_MS, open: 100, high: 120, low: 95, close: 115 },
    { openTime: 12 * HOUR_MS, open: 115, high: 130, low: 110, close: 125 },
    { openTime: 13 * HOUR_MS, open: 125, high: 125, low: 80, close: 90 },
  ];

  it("excludes sell candle and uses up to 24 future candles", () => {
    const metrics = computePostClose24hExtrema({
      klinesAsc,
      sellCandleOpenTime: sellOpenTime,
      sellClosePrice: 100,
      sellCandleIndex: buildKlineOpenTimeIndex(klinesAsc).get(sellOpenTime),
    });

    expect(metrics.maxPriceAfterClose24h).toBe(130);
    expect(metrics.minPriceAfterClose24h).toBe(80);
    expect(metrics.maxPriceAfterClose24hPct).toBeCloseTo(30);
    expect(metrics.minPriceAfterClose24hPct).toBeCloseTo(-20);
  });

  it("returns null when no future candles exist", () => {
    const metrics = computePostClose24hExtrema({
      klinesAsc: klinesAsc.slice(0, 3),
      sellCandleOpenTime: sellOpenTime,
      sellClosePrice: 100,
    });

    expect(metrics.maxPriceAfterClose24h).toBeNull();
    expect(metrics.minPriceAfterClose24h).toBeNull();
  });

  it("returns null metrics for invalid sell close price", () => {
    const metrics = computePostClose24hExtrema({
      klinesAsc,
      sellCandleOpenTime: sellOpenTime,
      sellClosePrice: 0,
    });

    expect(metrics.maxPriceAfterClose24h).toBeNull();
    expect(metrics.minPriceAfterClose24h).toBeNull();
  });

  it("returns null metrics when sell candle is missing", () => {
    const metrics = computePostClose24hExtrema({
      klinesAsc,
      sellCandleOpenTime: 99 * HOUR_MS,
      sellClosePrice: 100,
    });

    expect(metrics.maxPriceAfterClose24h).toBeNull();
    expect(metrics.minPriceAfterClose24h).toBeNull();
  });

  it("uses partial window when fewer than 24 future candles exist", () => {
    const metrics = computePostClose24hExtrema({
      klinesAsc,
      sellCandleOpenTime: sellOpenTime,
      sellClosePrice: 100,
    });

    expect(metrics.maxPriceAfterClose24h).toBe(130);
    expect(metrics.minPriceAfterClose24h).toBe(80);
  });
});
