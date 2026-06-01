import type { TradePostClose24hMetrics } from "@/types/trade-metrics";
import { parseFiniteNumber } from "@/utils/parse-finite-number";

interface PostClose24hDbRow {
  maxPriceAfterClose24h: string | null;
  minPriceAfterClose24h: string | null;
  maxPriceAfterClose24hPct: string | null;
  minPriceAfterClose24hPct: string | null;
}

function parseOptionalNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = parseFiniteNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapPostClose24hFromDb(
  row: PostClose24hDbRow,
): TradePostClose24hMetrics {
  return {
    maxPriceAfterClose24h: parseOptionalNumber(row.maxPriceAfterClose24h),
    minPriceAfterClose24h: parseOptionalNumber(row.minPriceAfterClose24h),
    maxPriceAfterClose24hPct: parseOptionalNumber(row.maxPriceAfterClose24hPct),
    minPriceAfterClose24hPct: parseOptionalNumber(row.minPriceAfterClose24hPct),
  };
}
