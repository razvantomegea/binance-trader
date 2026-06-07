import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";

vi.mock("@/db");
vi.mock("@/helpers/notifications/notify-trade-executed");

import { getDb } from "@/db";
import { notifyTradeExecuted } from "@/helpers/notifications/notify-trade-executed";

import { placeTrade } from "./place-trade";

const mockedGetDb = vi.mocked(getDb);
const mockedNotifyTradeExecuted = vi.mocked(notifyTradeExecuted);

const CANDLE_OPEN_TIME = 3_600_000;

function setupDbMock(params: {
  openPosition?: {
    symbol: string;
    qty: string;
    buyPrice: string;
    maxPriceAfterBuy: string | null;
  } | null;
  tradeId?: number;
  tradeInsertResult?: Array<{ id: number }>;
  positionInsertError?: Error;
}) {
  const tradeReturning = vi
    .fn()
    .mockResolvedValue(
      params.tradeInsertResult ?? [{ id: params.tradeId ?? 7 }],
    );
  const tradeValues = vi.fn().mockReturnValue({ returning: tradeReturning });
  const tradeInsert = vi.fn().mockReturnValue({ values: tradeValues });

  const positionValues = params.positionInsertError
    ? vi.fn().mockRejectedValue(params.positionInsertError)
    : vi.fn().mockResolvedValue(undefined);
  const positionInsert = vi.fn().mockReturnValue({ values: positionValues });

  const positionWhere = vi
    .fn()
    .mockResolvedValue(params.openPosition ? [params.openPosition] : []);
  const positionFrom = vi.fn().mockReturnValue({ where: positionWhere });
  const positionSelect = vi.fn().mockReturnValue({ from: positionFrom });

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockReturnValue({ where: deleteWhere });

  let insertCall = 0;
  const insert = vi.fn().mockImplementation(() => {
    insertCall += 1;
    return insertCall === 1 ? tradeInsert() : positionInsert();
  });

  mockedGetDb.mockReturnValue({
    select: positionSelect,
    insert,
    delete: del,
  } as unknown as ReturnType<typeof getDb>);

  return {
    tradeInsert,
    positionInsert,
    del,
    tradeReturning,
    mockedNotifyTradeExecuted,
  };
}

function setupPlaceTradeSuite(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNotifyTradeExecuted.mockImplementation(() => {});
  });
}

describe("placeTrade validation and buy path", () => {
  setupPlaceTradeSuite();

  it("rejects invalid qty", async () => {
    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: 0,
        price: 100,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/Invalid qty/);
  });

  it("rejects invalid price", async () => {
    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: 1,
        price: -1,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/Invalid price/);
  });

  it("inserts BUY trade, opens position, and notifies", async () => {
    const { tradeInsert, positionInsert } = setupDbMock({ tradeId: 7 });

    await placeTrade({
      symbol: "BTCUSDT",
      side: "BUY",
      qty: 2,
      price: 150,
      interval: STRATEGY_INTERVAL,
      candleOpenTime: CANDLE_OPEN_TIME,
      reason: "entry_band",
      maxPriceAfterBuy: 155,
    });

    expect(tradeInsert).toHaveBeenCalled();
    expect(positionInsert).toHaveBeenCalled();
    expect(mockedNotifyTradeExecuted).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: 7,
        symbol: "BTCUSDT",
        side: "BUY",
      }),
    );
  });

  it("throws when SELL has no open position", async () => {
    setupDbMock({ openPosition: null });

    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "SELL",
        qty: 1,
        price: 100,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "exit",
      }),
    ).rejects.toThrow(/no open position/);
  });

  it("rolls back trade when position sync fails", async () => {
    const { del } = setupDbMock({
      positionInsertError: new Error("position insert failed"),
    });

    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: 1,
        price: 100,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/position insert failed/);

    expect(del).toHaveBeenCalled();
  });
});

describe("placeTrade sell and insertion edge cases", () => {
  setupPlaceTradeSuite();

  it("rejects non-finite qty and price", async () => {
    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: Number.NaN,
        price: 100,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/Invalid qty/);

    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: 1,
        price: Number.POSITIVE_INFINITY,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/Invalid price/);
  });

  it("executes SELL trade, closes position, and resolves max price from open position", async () => {
    const { del } = setupDbMock({
      openPosition: {
        symbol: "BTCUSDT",
        qty: "1",
        buyPrice: "90",
        maxPriceAfterBuy: "120",
      },
      tradeId: 9,
    });

    await placeTrade({
      symbol: "BTCUSDT",
      side: "SELL",
      qty: 1,
      price: 100,
      interval: STRATEGY_INTERVAL,
      candleOpenTime: CANDLE_OPEN_TIME,
      reason: "exit",
    });

    expect(del).toHaveBeenCalled();
    expect(mockedNotifyTradeExecuted).toHaveBeenCalledWith(
      expect.objectContaining({ tradeId: 9, side: "SELL" }),
    );
  });

  it("falls back to buy price when sell omits maxPriceAfterBuy on position", async () => {
    setupDbMock({
      openPosition: {
        symbol: "BTCUSDT",
        qty: "1",
        buyPrice: "88",
        maxPriceAfterBuy: null,
      },
    });

    await placeTrade({
      symbol: "BTCUSDT",
      side: "SELL",
      qty: 1,
      price: 100,
      interval: STRATEGY_INTERVAL,
      candleOpenTime: CANDLE_OPEN_TIME,
      reason: "exit",
    });

    expect(mockedNotifyTradeExecuted).toHaveBeenCalled();
  });

  it("throws when trade insert returns no row", async () => {
    setupDbMock({ tradeInsertResult: [] });

    await expect(
      placeTrade({
        symbol: "BTCUSDT",
        side: "BUY",
        qty: 1,
        price: 100,
        interval: STRATEGY_INTERVAL,
        candleOpenTime: CANDLE_OPEN_TIME,
        reason: "entry",
      }),
    ).rejects.toThrow(/Failed to insert trade/);
  });
});
