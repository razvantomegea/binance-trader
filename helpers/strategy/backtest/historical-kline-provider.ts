import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { CandleInterval, KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";
import { getLastClosedCandleOpenTime } from "@/utils/binance/candle-time";
import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";
import { processInBatches } from "@/utils/process-in-batches";

export { getLastClosedCandleOpenTime };

export function getHistoricalRange(params: { days: number; now?: number }): {
  startTime: number;
  endTime: number;
} {
  const endTime = getLastClosedCandleOpenTime(params.now);
  const lookbackMs = (params.days * 24 + STRATEGY_LOOKBACK_CLOSES) * HOUR_MS;
  return { startTime: endTime - lookbackMs, endTime };
}

export function buildCheckTimeline(params: {
  startTime: number;
  endTime: number;
  checkEveryMinutes: number;
}): number[] {
  const checkEveryMs = params.checkEveryMinutes * 60_000;
  const safeStep =
    Number.isFinite(checkEveryMs) && checkEveryMs > 0
      ? checkEveryMs
      : 15 * 60_000;
  const timeline: number[] = [];
  for (let t = params.startTime; t <= params.endTime; t += safeStep) {
    timeline.push(t);
  }
  return timeline;
}

export function getClosedWindowAt(params: {
  klinesAsc: KlineCandle[];
  targetTime: number;
  count: number;
}): KlineCandle[] | null {
  let idx = -1;
  for (let i = params.klinesAsc.length - 1; i >= 0; i -= 1) {
    if (params.klinesAsc[i]!.openTime <= params.targetTime) {
      idx = i;
      break;
    }
  }
  if (idx < 0) {
    return null;
  }

  const startIdx = idx - params.count + 1;
  if (startIdx < 0) {
    return null;
  }

  return params.klinesAsc.slice(startIdx, idx + 1).reverse();
}

export async function loadHistoricalKlinesBySymbol(params: {
  symbols: string[];
  interval: CandleInterval;
  startTime: number;
  endTime: number;
  concurrency: number;
}): Promise<Map<string, KlineCandle[]>> {
  const result = new Map<string, KlineCandle[]>();

  await processInBatches({
    items: params.symbols,
    batchSize: params.concurrency,
    processItem: async (symbol) => {
      const klines = await getHistoricalClosedKlines({
        symbol,
        interval: params.interval,
        startTime: params.startTime,
        endTime: params.endTime,
      });
      result.set(symbol, klines);
    },
  });

  return result;
}

export function getEvaluationStartOpenTime(params: {
  rangeStartTime: number;
  lookbackCloses: number;
}): number {
  return params.rangeStartTime + (params.lookbackCloses - 1) * HOUR_MS;
}
