import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_PAPER_CASH } from "@/constants/binance";
import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/helpers/strategy/get-cash");
vi.mock("@/helpers/strategy/get-positions");
vi.mock("@/utils/binance/get-klines");

import { getCash } from "@/helpers/strategy/get-cash";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { getLatestClosedKline } from "@/utils/binance/get-klines";

import { buildPortfolioResponse } from "./build-portfolio-response";

const mockedGetCash = vi.mocked(getCash);
const mockedGetOpenPositions = vi.mocked(getOpenPositions);
const mockedGetLatestClosedKline = vi.mocked(getLatestClosedKline);

const BUY_TIME = new Date("2024-01-01T00:00:00.000Z");

const CANDLE: KlineCandle = {
  openTime: 3_600_000,
  open: 100,
  high: 110,
  low: 95,
  close: 110,
};

describe("buildPortfolioResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCash.mockResolvedValue(5000);
    mockedGetOpenPositions.mockResolvedValue(new Map());
  });

  it("returns cash-only portfolio when no positions", async () => {
    const result = await buildPortfolioResponse();

    expect(result.cash).toBe(5000);
    expect(result.equity).toBe(5000);
    expect(result.positionCount).toBe(0);
    expect(result.positions).toEqual([]);
    expect(result.totalPnl).toBe(5000 - INITIAL_PAPER_CASH);
  });

  it("includes unrealized metrics for open positions", async () => {
    mockedGetOpenPositions.mockResolvedValue(
      new Map([
        [
          "BTCUSDT",
          {
            symbol: "BTCUSDT",
            qty: 2,
            buyPrice: 100,
            maxPriceAfterBuy: 105,
            buyTime: BUY_TIME,
            buyTradeId: 3,
          },
        ],
      ]),
    );
    mockedGetLatestClosedKline.mockResolvedValue(CANDLE);

    const result = await buildPortfolioResponse();

    expect(mockedGetLatestClosedKline).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      interval: STRATEGY_INTERVAL,
    });
    expect(result.positionCount).toBe(1);
    expect(result.positions[0]).toMatchObject({
      symbol: "BTCUSDT",
      currentPrice: "110",
      unrealizedPnlPct: 10,
    });
    expect(result.equity).toBe(5000 + 2 * 110);
    expect(result.unrealizedPnl).toBe(20);
  });

  it("sorts positions by symbol", async () => {
    mockedGetOpenPositions.mockResolvedValue(
      new Map([
        [
          "ZECUSDT",
          {
            symbol: "ZECUSDT",
            qty: 1,
            buyPrice: 50,
            maxPriceAfterBuy: null,
            buyTime: BUY_TIME,
            buyTradeId: 1,
          },
        ],
        [
          "AAVEUSDT",
          {
            symbol: "AAVEUSDT",
            qty: 1,
            buyPrice: 80,
            maxPriceAfterBuy: null,
            buyTime: BUY_TIME,
            buyTradeId: 2,
          },
        ],
      ]),
    );
    mockedGetLatestClosedKline.mockResolvedValue(null);

    const result = await buildPortfolioResponse();
    expect(result.positions.map((p) => p.symbol)).toEqual([
      "AAVEUSDT",
      "ZECUSDT",
    ]);
  });
});
