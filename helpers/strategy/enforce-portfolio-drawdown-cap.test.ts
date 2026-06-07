import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/helpers/strategy/get-positions");
vi.mock("@/helpers/strategy/snapshot-equity");
vi.mock("@/helpers/strategy/exposure-peak-equity", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    getExposurePeakEquity: vi.fn(),
    setExposurePeakEquity: vi.fn(),
  };
});
vi.mock("@/helpers/strategy/place-trade");
vi.mock("@/utils/binance/get-klines");

import { EXIT_PORTFOLIO_DRAWDOWN_REASON } from "@/helpers/strategy/backtest/liquidate-open-positions";
import {
  getExposurePeakEquity,
  setExposurePeakEquity,
} from "@/helpers/strategy/exposure-peak-equity";
import { getOpenPositions } from "@/helpers/strategy/get-positions";
import { placeTrade } from "@/helpers/strategy/place-trade";
import { snapshotEquity } from "@/helpers/strategy/snapshot-equity";
import { getLatestClosedKline } from "@/utils/binance/get-klines";

import { enforcePortfolioDrawdownCap } from "./enforce-portfolio-drawdown-cap";

const mockedGetOpenPositions = vi.mocked(getOpenPositions);
const mockedSnapshotEquity = vi.mocked(snapshotEquity);
const mockedGetExposurePeakEquity = vi.mocked(getExposurePeakEquity);
const mockedSetExposurePeakEquity = vi.mocked(setExposurePeakEquity);
const mockedPlaceTrade = vi.mocked(placeTrade);
const mockedGetLatestClosedKline = vi.mocked(getLatestClosedKline);

const POSITION = {
  symbol: "BTCUSDT",
  qty: 1,
  buyPrice: 100,
  maxPriceAfterBuy: 120,
  buyTime: new Date(3_600_000),
  buyTradeId: 1,
};

const CANDLE: KlineCandle = {
  openTime: 7_200_000,
  open: 95,
  high: 98,
  low: 90,
  close: 92,
};

describe("enforcePortfolioDrawdownCap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSetExposurePeakEquity.mockResolvedValue(undefined);
    mockedPlaceTrade.mockResolvedValue(undefined);
    mockedGetLatestClosedKline.mockResolvedValue(CANDLE);
    mockedSnapshotEquity.mockResolvedValue({ cash: 10_000, equity: 10_000 });
  });

  it("clears peak and returns zero when no open positions", async () => {
    mockedGetOpenPositions.mockResolvedValue(new Map());

    const result = await enforcePortfolioDrawdownCap({});

    expect(result).toEqual({ liquidated: 0 });
    expect(mockedSetExposurePeakEquity).toHaveBeenCalledWith({
      interval: STRATEGY_INTERVAL,
      peakEquity: null,
    });
    expect(mockedSnapshotEquity).toHaveBeenCalledWith({
      interval: STRATEGY_INTERVAL,
    });
  });

  it("updates peak without liquidating when drawdown not breached", async () => {
    mockedGetOpenPositions.mockResolvedValue(new Map([["BTCUSDT", POSITION]]));
    mockedSnapshotEquity.mockResolvedValue({ cash: 5000, equity: 9500 });
    mockedGetExposurePeakEquity.mockResolvedValue(10_000);

    const result = await enforcePortfolioDrawdownCap({});

    expect(result).toEqual({ liquidated: 0 });
    expect(mockedSetExposurePeakEquity).toHaveBeenCalledWith({
      interval: STRATEGY_INTERVAL,
      peakEquity: 10_000,
    });
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("liquidates all symbols and clears peak when drawdown breached", async () => {
    mockedGetOpenPositions.mockResolvedValue(new Map([["BTCUSDT", POSITION]]));
    mockedSnapshotEquity.mockResolvedValue({ cash: 5000, equity: 8000 });
    mockedGetExposurePeakEquity.mockResolvedValue(10_000);

    const result = await enforcePortfolioDrawdownCap({});

    expect(result).toEqual({ liquidated: 1 });
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "BTCUSDT",
        side: "SELL",
        reason: EXIT_PORTFOLIO_DRAWDOWN_REASON,
      }),
    );
    expect(mockedSetExposurePeakEquity).toHaveBeenLastCalledWith({
      interval: STRATEGY_INTERVAL,
      peakEquity: null,
    });
  });

  it("counts failed liquidations without throwing", async () => {
    mockedGetOpenPositions.mockResolvedValue(new Map([["BTCUSDT", POSITION]]));
    mockedSnapshotEquity.mockResolvedValue({ cash: 5000, equity: 8000 });
    mockedGetExposurePeakEquity.mockResolvedValue(10_000);
    mockedPlaceTrade.mockRejectedValue(new Error("order failed"));

    const result = await enforcePortfolioDrawdownCap({});

    expect(result).toEqual({ liquidated: 0 });
  });

  it("falls back to position buy price when latest kline is missing", async () => {
    mockedGetOpenPositions.mockResolvedValue(new Map([["BTCUSDT", POSITION]]));
    mockedSnapshotEquity.mockResolvedValue({ cash: 5000, equity: 8000 });
    mockedGetExposurePeakEquity.mockResolvedValue(10_000);
    mockedGetLatestClosedKline.mockResolvedValue(null);

    const result = await enforcePortfolioDrawdownCap({ interval: "1h" });

    expect(result).toEqual({ liquidated: 1 });
    expect(mockedPlaceTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        price: expect.any(Number),
        candleOpenTime: POSITION.buyTime.getTime(),
      }),
    );
  });
});
