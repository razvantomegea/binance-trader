import { describe, expect, it } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";
import { evaluateDecision } from "@/helpers/strategy/decision-core";
import { NULL_TRADE_POST_CLOSE_24H } from "@/types/trade-metrics";
import { HOUR_MS } from "@/utils/binance/candle-time";

describe("simulated ledger", () => {
  it("records buy and hold transitions", () => {
    const ledger = new SimulatedLedger(10_000, 10);
    const openTime = 1000 * HOUR_MS;

    const buy = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime - i * HOUR_MS,
        high: 150,
        low: i === 0 ? 150 : 100,
        close: i === 0 ? 150 : 100,
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
        low: 185,
        close: 200,
      })),
      position: ledger.getPosition("TESTUSDT"),
      cash: ledger.cash,
      lastProcessedOpenTime: buy.candleOpenTime,
      lastSellOpenTime: null,
    });

    expect(hold.action).toBe("HOLD");
    ledger.applyDecision({ symbol: "TESTUSDT", decision: hold, price: 200 });

    expect(hold.action).toBe("HOLD");
    ledger.applyDecision({ symbol: "TESTUSDT", decision: hold, price: 200 });
    expect(ledger.positions.size).toBe(1);
    expect(ledger.trades).toHaveLength(1);
  });

  it("records sell and finalized trade metrics", () => {
    const ledger = new SimulatedLedger(10_000, 10);
    const openTime = 1000 * HOUR_MS;

    const buy = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime - i * HOUR_MS,
        high: 150,
        low: i === 0 ? 150 : 100,
        close: i === 0 ? 150 : 100,
      })),
      position: undefined,
      cash: ledger.cash,
      lastProcessedOpenTime: null,
      lastSellOpenTime: null,
    });
    ledger.applyDecision({ symbol: "TESTUSDT", decision: buy, price: 150 });

    const hold = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime + HOUR_MS - i * HOUR_MS,
        high: 200,
        low: 185,
        close: 200,
      })),
      position: ledger.getPosition("TESTUSDT"),
      cash: ledger.cash,
      lastProcessedOpenTime: buy.candleOpenTime,
      lastSellOpenTime: null,
    });
    ledger.applyDecision({ symbol: "TESTUSDT", decision: hold, price: 200 });

    const sell = evaluateDecision({
      closed: Array.from({ length: STRATEGY_LOOKBACK_CLOSES }, (_, i) => ({
        openTime: openTime + 2 * HOUR_MS - i * HOUR_MS,
        high: 200,
        low: 150,
        close: 150,
      })),
      position: ledger.getPosition("TESTUSDT"),
      cash: ledger.cash,
      lastProcessedOpenTime: hold.candleOpenTime,
      lastSellOpenTime: null,
    });

    ledger.applyDecision({
      symbol: "TESTUSDT",
      decision: sell,
      price: 150,
    });

    expect(sell.action).toBe("SELL");
    expect(ledger.positions.size).toBe(0);
    expect(ledger.trades).toHaveLength(2);
    expect(ledger.cash).toBeLessThan(10_000);

    expect(ledger.trades[0]).toMatchObject({
      openPrice: 150,
      closePrice: null,
      maxPriceAfterBuy: 150,
      realizedPnlPct: null,
    });
    expect(ledger.trades[1]).toMatchObject({
      openPrice: 150,
      closePrice: 150,
      maxPriceAfterBuy: 200,
      realizedPnlPct: 0,
      ...NULL_TRADE_POST_CLOSE_24H,
    });
  });
});
