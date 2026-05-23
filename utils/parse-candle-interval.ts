import { CANDLE_INTERVALS } from "@/constants/binance";
import type { CandleInterval } from "@/types/binance";

export function parseSingleCandleInterval(
  value: string | null,
  defaultInterval: CandleInterval = "H1",
): CandleInterval | null {
  if (!value) {
    return defaultInterval;
  }

  const normalized = value.trim().toUpperCase();

  if (!CANDLE_INTERVALS.includes(normalized as CandleInterval)) {
    return null;
  }

  return normalized as CandleInterval;
}
