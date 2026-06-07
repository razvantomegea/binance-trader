import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");
vi.mock("@/helpers/strategy/place-trade");

import { getDb } from "@/db";
import { placeTrade } from "@/helpers/strategy/place-trade";
import { getLatestClosedKline } from "@/utils/binance/get-klines";

import {
  closeOpenPosition,
  PositionNotFoundError,
} from "./close-open-position";

const mockedGetDb = vi.mocked(getDb);
const mockedGetLatestClosedKline = vi.mocked(getLatestClosedKline);
const mockedPlaceTrade = vi.mocked(placeTrade);

const HOUR_MS = 3_600_000;
const CANDLE_OPEN_TIME = 1000 * HOUR_MS;
const CANDLE: KlineCandle = {
  openTime: CANDLE_OPEN_TIME,
  open: 120,
  high: 125,
  low: 115,
  close: 123.45,
};

function mockPositionRow(overrides: { symbol?: string; qty?: string } = {}) {
  const limit = vi.fn().mockResolvedValue([
    {
      symbol: overrides.symbol ?? "TESTUSDT",
      qty: overrides.qty ?? "10",
      buyPrice: "100",
      maxPriceAfterBuy: "110",
      buyTime: new Date(CANDLE_OPEN_TIME - HOUR_MS),
      buyTradeId: 1,
    },
  ]);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
    typeof getDb
  >);
  return { select, from, where, limit };
}

describe("closeOpenPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPlaceTrade.mockResolvedValue(undefined);
    mockedGetLatestClosedKline.mockResolvedValue(CANDLE);
  });

  it("sells full qty at latest closed H1 with manual_close reason", async () => {
    mockPositionRow();

    await closeOpenPosition({ symbol: "testusdt" });

    expect(mockedGetLatestClosedKline).toHaveBeenCalledWith({
      symbol: "TESTUSDT",
      interval: STRATEGY_INTERVAL,
    });
    expect(mockedPlaceTrade).toHaveBeenCalledWith({
      symbol: "TESTUSDT",
      side: "SELL",
      qty: 10,
      price: CANDLE.close,
      interval: STRATEGY_INTERVAL,
      candleOpenTime: CANDLE.openTime,
      reason: "manual_close",
    });
  });

  it("throws PositionNotFoundError when symbol has no open position", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(
      closeOpenPosition({ symbol: "MISSINGUSDT" }),
    ).rejects.toBeInstanceOf(PositionNotFoundError);
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("throws when symbol is empty", async () => {
    await expect(closeOpenPosition({ symbol: "   " })).rejects.toThrow(
      "symbol is required",
    );
    expect(mockedGetDb).not.toHaveBeenCalled();
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });

  it("throws when no valid closed candle is available", async () => {
    mockPositionRow();
    mockedGetLatestClosedKline.mockResolvedValue(null);

    await expect(closeOpenPosition({ symbol: "TESTUSDT" })).rejects.toThrow(
      "No valid closed candle for TESTUSDT",
    );
    expect(mockedPlaceTrade).not.toHaveBeenCalled();
  });
});
