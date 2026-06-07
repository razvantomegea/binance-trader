import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";
import { POST_CLOSE_WINDOW_CANDLES } from "@/types/trade-metrics";
import { HOUR_MS } from "@/utils/binance/candle-time";

vi.mock("@/db");
vi.mock("@/utils/binance/candle-time");
vi.mock("@/utils/binance/get-klines");

import { getLastClosedCandleOpenTime } from "@/utils/binance/candle-time";
import { getDb } from "@/db";
import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";

import { backfillPostClose24hMetrics } from "./backfill-post-close-24h";

const mockedGetDb = vi.mocked(getDb);
const mockedGetLastClosed = vi.mocked(getLastClosedCandleOpenTime);
const mockedGetHistorical = vi.mocked(getHistoricalClosedKlines);

const LAST_CLOSED = 100 * HOUR_MS;
const SELL_OPEN = LAST_CLOSED - 2 * HOUR_MS;

function mockBackfillDb(rows: Array<Record<string, unknown>>) {
  const selectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  mockedGetDb.mockReturnValue({
    select: vi.fn().mockReturnValue(selectChain),
    update,
  } as unknown as ReturnType<typeof getDb>);

  return { update, updateSet, updateWhere };
}

describe("backfillPostClose24hMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetLastClosed.mockReturnValue(LAST_CLOSED);
  });

  it("returns zero counts when no eligible sells", async () => {
    mockBackfillDb([]);

    await expect(backfillPostClose24hMetrics()).resolves.toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it("updates trade when post-close extrema are computable", async () => {
    const { update } = mockBackfillDb([
      {
        id: 10,
        symbol: "BTCUSDT",
        price: "100",
        interval: STRATEGY_INTERVAL,
        candleOpenTime: new Date(SELL_OPEN),
      },
    ]);

    const futureKlines: KlineCandle[] = [
      {
        openTime: SELL_OPEN + HOUR_MS,
        open: 100,
        high: 105,
        low: 99,
        close: 104,
      },
    ];
    mockedGetHistorical.mockResolvedValue([
      { openTime: SELL_OPEN, open: 100, high: 100, low: 100, close: 100 },
      ...futureKlines,
    ]);

    const result = await backfillPostClose24hMetrics();

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0 });
    expect(update).toHaveBeenCalled();
    expect(mockedGetHistorical).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTCUSDT",
        startTime: SELL_OPEN,
        endTime: SELL_OPEN + POST_CLOSE_WINDOW_CANDLES * HOUR_MS,
      }),
    );
  });

  it("skips row when metrics cannot be computed", async () => {
    mockBackfillDb([
      {
        id: 11,
        symbol: "ETHUSDT",
        price: "0",
        interval: STRATEGY_INTERVAL,
        candleOpenTime: new Date(SELL_OPEN),
      },
    ]);

    const result = await backfillPostClose24hMetrics();
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1 });
    expect(mockedGetHistorical).not.toHaveBeenCalled();
  });

  it("skips row when kline fetch throws", async () => {
    mockBackfillDb([
      {
        id: 12,
        symbol: "SOLUSDT",
        price: "50",
        interval: STRATEGY_INTERVAL,
        candleOpenTime: new Date(SELL_OPEN),
      },
    ]);
    mockedGetHistorical.mockRejectedValue(new Error("network"));

    const result = await backfillPostClose24hMetrics();
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1 });
  });
});
