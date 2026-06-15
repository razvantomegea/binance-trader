import { describe, expect, it } from "vitest";

import type { PositionRow, TradeRow } from "@/types/portfolio";

import { buildTradeMarkers } from "./build-trade-markers";

const baseTrade: TradeRow = {
  id: 1,
  symbol: "ETHUSDT",
  side: "BUY",
  qty: "1",
  price: "2800",
  openPrice: "2800",
  closePrice: null,
  maxPriceAfterBuy: "3100",
  maxPriceAfterClose24h: null,
  minPriceAfterClose24h: null,
  maxPriceAfterClose24hPct: null,
  minPriceAfterClose24hPct: null,
  notional: "2800",
  interval: "H1",
  candleOpenTime: "2026-06-07T08:00:00.000Z",
  reason: "entry signal",
  createdAt: "2026-06-07T09:00:00.000Z",
  realizedPnlPct: null,
};

const sellTrade: TradeRow = {
  ...baseTrade,
  id: 2,
  side: "SELL",
  price: "3000",
  openPrice: "2800",
  closePrice: "3000",
  candleOpenTime: "2026-06-07T09:00:00.000Z",
  reason: "trailing stop",
  realizedPnlPct: 7.14,
};

const openPosition: PositionRow = {
  symbol: "ETHUSDT",
  qty: "1",
  buyPrice: "2800",
  maxPriceAfterBuy: "3100",
  buyTime: "2026-06-07T08:00:00.000Z",
  buyTradeId: 1,
  currentPrice: "2900",
  unrealizedPnlPct: 3.57,
};

describe("buildTradeMarkers", () => {
  it("maps BUY to entry and SELL to exit for matching symbol", () => {
    const markers = buildTradeMarkers({
      symbol: "ETHUSDT",
      trades: [baseTrade, sellTrade],
      positions: [],
    });

    expect(markers).toEqual([
      {
        kind: "entry",
        openTimeMs: Date.parse("2026-06-07T08:00:00.000Z"),
        price: 2800,
        id: "1",
      },
      {
        kind: "exit",
        openTimeMs: Date.parse("2026-06-07T09:00:00.000Z"),
        price: 3000,
        id: "2",
      },
    ]);
  });

  it("filters out trades for other symbols", () => {
    const markers = buildTradeMarkers({
      symbol: "BTCUSDT",
      trades: [baseTrade, sellTrade],
      positions: [],
    });

    expect(markers).toEqual([]);
  });

  it("adds position entry when BUY trade is not in loaded trades", () => {
    const markers = buildTradeMarkers({
      symbol: "ETHUSDT",
      trades: [],
      positions: [openPosition],
    });

    expect(markers).toEqual([
      {
        kind: "entry",
        openTimeMs: Date.parse("2026-06-07T08:00:00.000Z"),
        price: 2800,
        id: "position-1",
      },
    ]);
  });

  it("skips position entry when matching BUY trade already exists", () => {
    const markers = buildTradeMarkers({
      symbol: "ETHUSDT",
      trades: [baseTrade],
      positions: [openPosition],
    });

    expect(markers).toHaveLength(1);
    expect(markers[0]?.id).toBe("1");
  });

  it("skips trades with invalid candleOpenTime or price", () => {
    const markers = buildTradeMarkers({
      symbol: "ETHUSDT",
      trades: [
        { ...baseTrade, candleOpenTime: "invalid" },
        { ...sellTrade, price: "not-a-number" },
        sellTrade,
      ],
      positions: [],
    });

    expect(markers).toEqual([
      {
        kind: "exit",
        openTimeMs: Date.parse("2026-06-07T09:00:00.000Z"),
        price: 3000,
        id: "2",
      },
    ]);
  });

  it("skips position entry with invalid buyTime or buyPrice", () => {
    const markers = buildTradeMarkers({
      symbol: "ETHUSDT",
      trades: [],
      positions: [{ ...openPosition, buyTime: "invalid", buyPrice: "bad" }],
    });

    expect(markers).toEqual([]);
  });
});
