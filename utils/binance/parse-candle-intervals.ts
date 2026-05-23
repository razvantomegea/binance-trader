import { CANDLE_INTERVALS } from "@/constants/binance";
import type { CandleInterval } from "@/types/binance";

export function parseCandleIntervals(
  value: string | null,
): CandleInterval[] | null {
  if (!value) {
    return [...CANDLE_INTERVALS];
  }

  const requested = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  const invalid = requested.filter(
    (item) => !CANDLE_INTERVALS.includes(item as CandleInterval),
  );

  if (invalid.length > 0) {
    return null;
  }

  return requested as CandleInterval[];
}
