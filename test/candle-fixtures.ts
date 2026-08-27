import type { CandleSlice } from "@/helpers/strategy/decision-core";
import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

export type CandleSpec =
  | number
  | { close: number; high?: number; low?: number; open?: number };

function resolveSpec(spec: CandleSpec): {
  close: number;
  high: number;
  low: number;
  open: number;
} {
  if (typeof spec === "number") {
    return { close: spec, high: spec, low: spec, open: spec };
  }
  const { close } = spec;
  return {
    close,
    high: spec.high ?? close,
    low: spec.low ?? close,
    open: spec.open ?? close,
  };
}

export function makeCandleSlice(
  openTime: number,
  close: number,
  overrides: Partial<Pick<CandleSlice, "high" | "low">> = {},
): CandleSlice {
  return {
    openTime,
    high: overrides.high ?? close,
    low: overrides.low ?? close,
    close,
  };
}

export function makeCandleSlices(
  startOpenTime: number,
  specs: CandleSpec[],
): CandleSlice[] {
  return specs.map((spec, i) => {
    const openTime = startOpenTime - i * HOUR_MS;
    const resolved = resolveSpec(spec);
    return makeCandleSlice(openTime, resolved.close, {
      high: resolved.high,
      low: resolved.low,
    });
  });
}

function makeKlineCandle(
  openTime: number,
  close: number,
  overrides: Partial<Pick<KlineCandle, "high" | "low" | "open">> = {},
): KlineCandle {
  return {
    openTime,
    open: overrides.open ?? close,
    high: overrides.high ?? close,
    low: overrides.low ?? close,
    close,
  };
}

export function makeKlineCandles(
  startOpenTime: number,
  specs: CandleSpec[],
): KlineCandle[] {
  return specs.map((spec, i) => {
    const openTime = startOpenTime - i * HOUR_MS;
    const resolved = resolveSpec(spec);
    return makeKlineCandle(openTime, resolved.close, {
      high: resolved.high,
      low: resolved.low,
      open: resolved.open,
    });
  });
}
