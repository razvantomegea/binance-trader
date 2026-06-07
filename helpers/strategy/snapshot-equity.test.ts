import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/db");
vi.mock("@/helpers/strategy/get-cash");
vi.mock("@/helpers/strategy/get-positions");
vi.mock("@/utils/binance/get-klines");

import { getDb } from "@/db";
import { getCash } from "@/helpers/strategy/get-cash";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { getLatestClosedKline } from "@/utils/binance/get-klines";

import { snapshotEquity } from "./snapshot-equity";

const mockedGetDb = vi.mocked(getDb);
const mockedGetCash = vi.mocked(getCash);
const mockedGetOpenPositions = vi.mocked(getOpenPositions);
const mockedGetLatestClosedKline = vi.mocked(getLatestClosedKline);

const CANDLE: KlineCandle = {
  openTime: 3_600_000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
};

describe("snapshotEquity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCash.mockResolvedValue(8000);
    mockedGetOpenPositions.mockResolvedValue(new Map());
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn().mockReturnValue({ values });
    mockedGetDb.mockReturnValue({ insert } as unknown as ReturnType<
      typeof getDb
    >);
  });

  it("persists cash-only equity when no positions", async () => {
    const result = await snapshotEquity({ interval: STRATEGY_INTERVAL });

    expect(result).toEqual({ cash: 8000, equity: 8000 });
    expect(mockedGetLatestClosedKline).not.toHaveBeenCalled();
    expect(mockedGetDb().insert).toHaveBeenCalled();
  });

  it("adds mark-to-market position value from latest closed kline", async () => {
    mockedGetOpenPositions.mockResolvedValue(
      new Map([
        [
          "BTCUSDT",
          {
            symbol: "BTCUSDT",
            qty: 2,
            buyPrice: 90,
            maxPriceAfterBuy: 100,
            buyTime: new Date(0),
            buyTradeId: 1,
          },
        ],
      ]),
    );
    mockedGetLatestClosedKline.mockResolvedValue(CANDLE);

    const result = await snapshotEquity({ interval: STRATEGY_INTERVAL });

    expect(mockedGetLatestClosedKline).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      interval: STRATEGY_INTERVAL,
    });
    expect(result.equity).toBe(8000 + 2 * CANDLE.close);
  });

  it("skips positions with missing kline close", async () => {
    mockedGetOpenPositions.mockResolvedValue(
      new Map([
        [
          "ETHUSDT",
          {
            symbol: "ETHUSDT",
            qty: 5,
            buyPrice: 100,
            maxPriceAfterBuy: null,
            buyTime: new Date(0),
            buyTradeId: 2,
          },
        ],
      ]),
    );
    mockedGetLatestClosedKline.mockResolvedValue(null);

    const result = await snapshotEquity({ interval: STRATEGY_INTERVAL });
    expect(result.equity).toBe(8000);
  });
});
