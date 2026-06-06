import type { KlineCandle } from "@/types/binance";
import { getUpdatedPeakPrice } from "@/utils/strategy/trailing-stop";

interface ComputePeakWhileOpenParams {
  buyPrice: number;
  buyOpenTime: number;
  klines: Pick<KlineCandle, "openTime" | "high" | "close">[];
  sellOpenTime?: number;
}

export function computePeakWhilePositionOpen({
  buyPrice,
  buyOpenTime,
  klines,
  sellOpenTime,
}: ComputePeakWhileOpenParams): number {
  let peak = buyPrice;

  for (const kline of klines) {
    if (kline.openTime < buyOpenTime) {
      continue;
    }
    if (sellOpenTime !== undefined && kline.openTime > sellOpenTime) {
      break;
    }

    peak = getUpdatedPeakPrice({
      currentMax: peak,
      high: kline.high,
      close: kline.close,
    });
  }

  return peak;
}
