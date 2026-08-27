import { vi } from "vitest";

import type { getDb } from "@/db";
import type { EvaluateSymbolResult } from "@/helpers/strategy/evaluate-symbol";
import type { OpenPosition } from "@/helpers/strategy/get-positions";
import { type CandleSpec, makeKlineCandles } from "@/test/candle-fixtures";
import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

export const EVALUATE_SYMBOL_BASE_PARAMS = {
  symbol: "TESTUSDT",
  interval: "H1" as const,
  cash: 10_000,
  lastProcessedOpenTime: null as number | null,
};

function makeOpenPosition(overrides: Partial<OpenPosition> = {}): OpenPosition {
  return {
    symbol: "TESTUSDT",
    qty: 10,
    buyPrice: 100,
    maxPriceAfterBuy: 100,
    buyTime: new Date(1000 * HOUR_MS),
    buyTradeId: 1,
    ...overrides,
  };
}

export function mockDbUpdate(
  mockedGetDb: ReturnType<typeof vi.mocked<typeof getDb>>,
): void {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  mockedGetDb.mockReturnValue({ update } as unknown as ReturnType<
    typeof getDb
  >);
}

function evaluateOpenSymbol(params: {
  evaluateSymbol: (args: {
    symbol: string;
    interval: "H1";
    cash: number;
    lastProcessedOpenTime: number | null;
    position: OpenPosition;
  }) => Promise<EvaluateSymbolResult>;
  setKlines: (candles: KlineCandle[]) => void;
  specs: CandleSpec[];
  hoursAfterBuy?: number;
  positionOverrides?: Partial<OpenPosition>;
}): Promise<EvaluateSymbolResult> {
  const buyOpenTime = 1000 * HOUR_MS;
  const latestOpenTime = buyOpenTime + (params.hoursAfterBuy ?? 1) * HOUR_MS;
  params.setKlines(makeKlineCandles(latestOpenTime, params.specs));
  return params.evaluateSymbol({
    ...EVALUATE_SYMBOL_BASE_PARAMS,
    position: makeOpenPosition({
      buyTime: new Date(buyOpenTime),
      buyPrice: 100,
      ...params.positionOverrides,
    }),
  });
}

export function createEvaluateOpenSymbol(deps: {
  evaluateSymbol: Parameters<typeof evaluateOpenSymbol>[0]["evaluateSymbol"];
  setKlines: Parameters<typeof evaluateOpenSymbol>[0]["setKlines"];
}) {
  return (
    params: Omit<
      Parameters<typeof evaluateOpenSymbol>[0],
      "evaluateSymbol" | "setKlines"
    >,
  ) => evaluateOpenSymbol({ ...deps, ...params });
}
