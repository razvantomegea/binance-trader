import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";
import { HOUR_MS } from "@/utils/binance/candle-time";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");

import { getDb } from "@/db";
import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";

import { backfillMaxPriceAfterBuy } from "./backfill-max-price-after-buy";

const mockedGetDb = vi.mocked(getDb);
const mockedGetHistorical = vi.mocked(getHistoricalClosedKlines);

const BUY_TIME = new Date("2024-01-01T00:00:00.000Z");
const SELL_TIME = new Date("2024-01-02T00:00:00.000Z");
const BUY_OPEN = BUY_TIME.getTime();
const SELL_OPEN = SELL_TIME.getTime();

function mockBackfillDb(params: {
  sells: Array<Record<string, unknown>>;
  buys?: Array<Record<string, unknown>>;
}) {
  const sellFrom = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(params.sells),
    }),
  });

  const buyOrderBy = vi.fn().mockResolvedValue(params.buys ?? []);
  const buyWhere = vi.fn().mockReturnValue({ orderBy: buyOrderBy });
  const buyFrom = vi.fn().mockReturnValue({ where: buyWhere });

  let selectCall = 0;
  const select = vi.fn().mockImplementation(() => {
    selectCall += 1;
    if (selectCall === 1) {
      return { from: sellFrom };
    }
    return { from: buyFrom };
  });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const update = vi.fn().mockReturnValue({ set: updateSet });

  mockedGetDb.mockReturnValue({ select, update } as unknown as ReturnType<
    typeof getDb
  >);

  return { update };
}

describe("backfillMaxPriceAfterBuy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero counts when no sells exist", async () => {
    mockBackfillDb({ sells: [] });

    await expect(backfillMaxPriceAfterBuy()).resolves.toEqual({
      scanned: 0,
      updated: 0,
      skipped: 0,
    });
  });

  it("updates sell when computed peak differs from stored value", async () => {
    const { update } = mockBackfillDb({
      sells: [
        {
          id: 5,
          symbol: "BTCUSDT",
          maxPriceAfterBuy: null,
          interval: STRATEGY_INTERVAL,
          candleOpenTime: SELL_TIME,
          createdAt: SELL_TIME,
        },
      ],
      buys: [
        {
          symbol: "BTCUSDT",
          price: "100",
          candleOpenTime: BUY_TIME,
          createdAt: BUY_TIME,
        },
      ],
    });

    const klines: KlineCandle[] = [
      { openTime: BUY_OPEN, open: 100, high: 100, low: 100, close: 100 },
      {
        openTime: BUY_OPEN + HOUR_MS,
        open: 100,
        high: 120,
        low: 99,
        close: 110,
      },
      { openTime: SELL_OPEN, open: 110, high: 115, low: 105, close: 112 },
    ];
    mockedGetHistorical.mockResolvedValue(klines);

    const result = await backfillMaxPriceAfterBuy();

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0 });
    expect(update).toHaveBeenCalled();
  });

  it("skips sell when stored peak already matches computed peak", async () => {
    const { update } = mockBackfillDb({
      sells: [
        {
          id: 6,
          symbol: "ETHUSDT",
          maxPriceAfterBuy: "120",
          interval: STRATEGY_INTERVAL,
          candleOpenTime: SELL_TIME,
          createdAt: SELL_TIME,
        },
      ],
      buys: [
        {
          symbol: "ETHUSDT",
          price: "100",
          candleOpenTime: BUY_TIME,
          createdAt: BUY_TIME,
        },
      ],
    });

    mockedGetHistorical.mockResolvedValue([
      { openTime: BUY_OPEN, open: 100, high: 100, low: 100, close: 100 },
      {
        openTime: BUY_OPEN + HOUR_MS,
        open: 100,
        high: 120,
        low: 99,
        close: 110,
      },
      { openTime: SELL_OPEN, open: 110, high: 115, low: 105, close: 112 },
    ]);

    const result = await backfillMaxPriceAfterBuy();
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1 });
    expect(update).not.toHaveBeenCalled();
  });

  it("skips sell when matching buy is missing", async () => {
    mockBackfillDb({
      sells: [
        {
          id: 7,
          symbol: "SOLUSDT",
          maxPriceAfterBuy: null,
          interval: STRATEGY_INTERVAL,
          candleOpenTime: SELL_TIME,
          createdAt: SELL_TIME,
        },
      ],
      buys: [],
    });

    const result = await backfillMaxPriceAfterBuy();
    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1 });
    expect(mockedGetHistorical).not.toHaveBeenCalled();
  });
});
