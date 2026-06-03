import { describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import { buildBacktestReport } from "@/helpers/strategy/backtest/build-backtest-report";
import {
  buildCheckTimeline,
  getClosedWindowAt,
  getEvaluationStartOpenTime,
} from "@/helpers/strategy/backtest/historical-kline-provider";
import { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";
import { evaluateDecision } from "@/helpers/strategy/decision-core";
import { NULL_TRADE_POST_CLOSE_24H } from "@/types/trade-metrics";
import { HOUR_MS } from "@/utils/binance/candle-time";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/utils/binance/get-usdt-symbols");
vi.mock("@/utils/binance/get-klines");

import { getHistoricalClosedKlines } from "@/utils/binance/get-klines";
import { getTradingSymbols } from "@/utils/binance/get-usdt-symbols";

import { runBacktest } from "./backtest-runner";

const mockedGetTradingSymbols = vi.mocked(getTradingSymbols);
const mockedGetHistoricalClosedKlines = vi.mocked(getHistoricalClosedKlines);

function makeAscendingKlines(params: {
  startOpenTime: number;
  closes: number[];
}): KlineCandle[] {
  return params.closes.map((close, index) => ({
    openTime: params.startOpenTime + index * HOUR_MS,
    open: close,
    high: close,
    low: close,
    close,
  }));
}

describe("historical kline helpers", () => {
  it("builds closed window at target open time", () => {
    const klinesAsc = makeAscendingKlines({
      startOpenTime: 0,
      closes: Array.from({ length: 30 }, (_, i) => 100 + i),
    });

    const window = getClosedWindowAt({
      klinesAsc,
      targetTime: 24 * HOUR_MS,
      count: STRATEGY_LOOKBACK_CLOSES,
    });

    expect(window).toHaveLength(STRATEGY_LOOKBACK_CLOSES);
    expect(window?.[0]?.openTime).toBe(23 * HOUR_MS);
    expect(window?.[23]?.openTime).toBe(0);
  });

  it("builds check timeline", () => {
    const timeline = buildCheckTimeline({
      startTime: 0,
      endTime: HOUR_MS,
      checkEveryMinutes: 15,
    });

    expect(timeline).toEqual([0, 900_000, 1_800_000, 2_700_000, HOUR_MS]);
  });

  it("computes evaluation start with lookback", () => {
    const start = getEvaluationStartOpenTime({
      rangeStartTime: 0,
      lookbackCloses: STRATEGY_LOOKBACK_CLOSES,
    });

    expect(start).toBe((STRATEGY_LOOKBACK_CLOSES - 1) * HOUR_MS);
  });
});

describe("simulated ledger", () => {
  it("records buy and sell with fees", () => {
    const ledger = new SimulatedLedger(10_000, 10);
    const openTime = 1000 * HOUR_MS;

    const buy = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime - i * HOUR_MS,
        high: 150,
        low: i === 0 ? 150 : 100,
        close: 150,
      })),
      position: undefined,
      cash: ledger.cash,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });

    expect(buy.action).toBe("BUY");
    ledger.applyDecision({ symbol: "TESTUSDT", decision: buy, price: 150 });
    expect(ledger.positions.size).toBe(1);
    expect(ledger.trades).toHaveLength(1);

    const hold = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime + HOUR_MS - i * HOUR_MS,
        high: 200,
        low: 150,
        close: 200,
      })),
      position: ledger.getPosition("TESTUSDT"),
      cash: ledger.cash,
      lastProcessedOpenTime: buy.candleOpenTime,
      lastSellOpenTime: null,
    });

    expect(hold.action).toBe("HOLD");
    ledger.applyDecision({ symbol: "TESTUSDT", decision: hold, price: 200 });

    const sell = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime + 2 * HOUR_MS - i * HOUR_MS,
        high: 200,
        low: 170,
        close: 170,
      })),
      position: ledger.getPosition("TESTUSDT"),
      cash: ledger.cash,
      lastProcessedOpenTime: hold.candleOpenTime,
      lastSellOpenTime: null,
    });

    expect(sell.action).toBe("SELL");
    ledger.applyDecision({
      symbol: "TESTUSDT",
      decision: sell,
      price: 170,
    });

    expect(ledger.positions.size).toBe(0);
    expect(ledger.trades).toHaveLength(2);
    expect(ledger.cash).toBeGreaterThan(10_000);

    const buyTrade = ledger.trades[0]!;
    expect(buyTrade.openPrice).toBe(150);
    expect(buyTrade.closePrice).toBeNull();
    expect(buyTrade.maxPriceAfterBuy).toBe(150);
    expect(buyTrade.realizedPnlPct).toBeNull();

    const sellTrade = ledger.trades[1]!;
    expect(sellTrade.openPrice).toBe(150);
    expect(sellTrade.closePrice).toBe(170);
    expect(sellTrade.maxPriceAfterBuy).toBe(200);
    expect(sellTrade.realizedPnlPct).toBeCloseTo(13.333, 2);
    expect(sellTrade).toMatchObject(NULL_TRADE_POST_CLOSE_24H);
  });
});

describe("buildBacktestReport", () => {
  it("computes pnl, drawdown, and win rate", () => {
    const report = buildBacktestReport({
      startTime: 0,
      endTime: 10 * HOUR_MS,
      initialCash: 10_000,
      finalEquity: 11_000,
      trades: [
        {
          symbol: "A",
          side: "BUY",
          qty: 1,
          price: 100,
          notional: 100,
          fee: 0,
          candleOpenTime: HOUR_MS,
          reason: "entry",
          openPrice: 100,
          closePrice: null,
          maxPriceAfterBuy: 100,
          realizedPnlPct: null,
          ...NULL_TRADE_POST_CLOSE_24H,
        },
        {
          symbol: "A",
          side: "SELL",
          qty: 1,
          price: 120,
          notional: 120,
          fee: 0,
          candleOpenTime: 2 * HOUR_MS,
          reason: "exit",
          openPrice: 100,
          closePrice: 120,
          maxPriceAfterBuy: 120,
          realizedPnlPct: 20,
          maxPriceAfterClose24h: 130,
          minPriceAfterClose24h: 110,
          maxPriceAfterClose24hPct: 8.333333,
          minPriceAfterClose24hPct: -8.333333,
        },
      ],
      equityCurve: [
        { openTime: 0, cash: 10_000, equity: 10_000 },
        { openTime: HOUR_MS, cash: 9_900, equity: 10_100 },
        { openTime: 2 * HOUR_MS, cash: 10_020, equity: 10_020 },
        { openTime: 3 * HOUR_MS, cash: 10_020, equity: 9_500 },
        { openTime: 4 * HOUR_MS, cash: 10_020, equity: 11_000 },
      ],
    });

    expect(report.pnlPct).toBeCloseTo(10);
    expect(report.maxDrawdownPct).toBeCloseTo(5.94, 2);
    expect(report.winRatePct).toBe(100);
    expect(report.totalTrades).toBe(1);
  });
});

describe("runBacktest", () => {
  it("runs deterministic simulation for one symbol", async () => {
    const fetchStart = 0;
    const closes = Array.from({ length: 48 }, (_, i) =>
      i < 24 ? 100 : i < 36 ? 160 : 240,
    );
    const klines = makeAscendingKlines({ startOpenTime: fetchStart, closes });

    mockedGetTradingSymbols.mockResolvedValue(["TESTUSDT"]);
    mockedGetHistoricalClosedKlines.mockResolvedValue(klines);

    const report = await runBacktest({
      days: 1,
      symbols: ["TESTUSDT"],
      initialCash: 10_000,
      concurrency: 1,
      feeBps: 0,
      interval: "H1",
      now: 48 * HOUR_MS + 1,
    });

    expect(report.trades.length).toBeGreaterThan(0);
    expect(report.equityCurve.length).toBeGreaterThan(0);
    expect(report.finalEquity).toBeGreaterThan(0);

    for (const trade of report.trades) {
      expect(trade).toHaveProperty("maxPriceAfterClose24h");
      expect(trade).toHaveProperty("minPriceAfterClose24hPct");
    }
  });

  it("blocks production environment", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    await expect(
      runBacktest({
        days: 1,
        symbols: ["TESTUSDT"],
        initialCash: 10_000,
        concurrency: 1,
        feeBps: 0,
        interval: "H1",
      }),
    ).rejects.toThrow(/localhost-only/i);

    process.env.NODE_ENV = previous;
  });

  it("uses all trading symbols when symbols are omitted", async () => {
    const fetchStart = 0;
    const klines = makeAscendingKlines({
      startOpenTime: fetchStart,
      closes: Array.from({ length: 48 }, () => 100),
    });

    mockedGetTradingSymbols.mockResolvedValue(["AAAUSDT", "BBBETH"]);
    mockedGetHistoricalClosedKlines.mockResolvedValue(klines);

    await runBacktest({
      days: 1,
      initialCash: 10_000,
      concurrency: 1,
      feeBps: 0,
      interval: "H1",
      now: 48 * HOUR_MS + 1,
    });

    expect(mockedGetTradingSymbols).toHaveBeenCalledOnce();
    expect(mockedGetHistoricalClosedKlines).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "AAAUSDT" }),
    );
    expect(mockedGetHistoricalClosedKlines).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "BBBETH" }),
    );
  });
});
