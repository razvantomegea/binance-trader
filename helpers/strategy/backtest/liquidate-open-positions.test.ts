import { describe, expect, it } from "vitest";

import { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";

import {
  EXIT_PORTFOLIO_DRAWDOWN_REASON,
  liquidateAllOpenPositions,
} from "./liquidate-open-positions";

describe("liquidateAllOpenPositions", () => {
  it("liquidates all open positions with default reason", () => {
    const ledger = new SimulatedLedger(10_000, 0);
    ledger.applyDecision({
      symbol: "BTCUSDT",
      decision: {
        action: "BUY",
        candleOpenTime: 1000,
        reason: "entry",
        qty: 1,
      },
      price: 100,
    });
    ledger.applyDecision({
      symbol: "ETHUSDT",
      decision: {
        action: "BUY",
        candleOpenTime: 1000,
        reason: "entry",
        qty: 2,
      },
      price: 50,
    });

    liquidateAllOpenPositions({
      ledger,
      markPrices: new Map([
        ["BTCUSDT", 90],
        ["ETHUSDT", 45],
      ]),
      candleOpenTime: 2000,
    });

    expect(ledger.positions.size).toBe(0);
    expect(ledger.trades.filter((t) => t.side === "SELL")).toHaveLength(2);
    expect(
      ledger.trades.some((t) => t.reason === EXIT_PORTFOLIO_DRAWDOWN_REASON),
    ).toBe(true);
  });

  it("uses custom reason and falls back to buy price when mark missing", () => {
    const ledger = new SimulatedLedger(10_000, 0);
    ledger.applyDecision({
      symbol: "ADAUSDT",
      decision: {
        action: "BUY",
        candleOpenTime: 1000,
        reason: "entry",
        qty: 10,
      },
      price: 1,
    });

    liquidateAllOpenPositions({
      ledger,
      markPrices: new Map(),
      candleOpenTime: 3000,
      reason: "forced_exit",
    });

    const sell = ledger.trades.find((t) => t.side === "SELL");
    expect(sell?.reason).toBe("forced_exit");
    expect(sell?.price).toBe(1);
  });
});
