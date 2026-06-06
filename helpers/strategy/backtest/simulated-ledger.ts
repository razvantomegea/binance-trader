import type { SimTrade } from "@/types/backtest";
import type { DecisionPositionState } from "@/helpers/strategy/decision-core";
import type { EvaluateDecisionResult } from "@/helpers/strategy/decision-core";
import {
  NULL_TRADE_POST_CLOSE_24H,
  type TradePostClose24hMetrics,
} from "@/types/trade-metrics";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";

export interface SimPosition {
  symbol: string;
  qty: number;
  buyPrice: number;
  maxPriceAfterBuy: number | null;
  buyOpenTime: number;
}

export class SimulatedLedger {
  cash: number;
  readonly feeBps: number;
  readonly trades: SimTrade[] = [];
  readonly positions = new Map<string, SimPosition>();
  readonly lastSellOpenTime = new Map<string, number>();

  constructor(initialCash: number, feeBps: number) {
    this.cash = initialCash;
    this.feeBps = feeBps;
  }

  getPosition(symbol: string): DecisionPositionState | undefined {
    const position = this.positions.get(symbol);
    if (!position) {
      return undefined;
    }

    return {
      qty: position.qty,
      buyPrice: position.buyPrice,
      maxPriceAfterBuy: position.maxPriceAfterBuy,
      buyOpenTime: position.buyOpenTime,
    };
  }

  applyHoldUpdate(params: { symbol: string; updatedMaxPrice?: number }): void {
    const position = this.positions.get(params.symbol);
    if (!position || params.updatedMaxPrice === undefined) {
      return;
    }

    const currentMax = position.maxPriceAfterBuy ?? position.buyPrice;
    if (params.updatedMaxPrice > currentMax) {
      position.maxPriceAfterBuy = params.updatedMaxPrice;
    }
  }

  applyDecision(params: {
    symbol: string;
    decision: EvaluateDecisionResult;
    price: number;
    postClose24h?: TradePostClose24hMetrics;
  }): boolean {
    const { symbol, decision, price } = params;

    if (decision.action === "HOLD") {
      this.applyHoldUpdate({
        symbol,
        updatedMaxPrice: decision.updatedMaxPrice,
      });
      return false;
    }

    if (decision.action !== "BUY" && decision.action !== "SELL") {
      return false;
    }

    if (
      decision.candleOpenTime === null ||
      decision.qty === undefined ||
      decision.reason === undefined
    ) {
      return false;
    }

    const qty = decision.qty;
    const notional = qty * price;
    const fee = (notional * this.feeBps) / 10_000;

    if (decision.action === "BUY") {
      const totalCost = notional + fee;
      if (totalCost > this.cash) {
        return false;
      }

      this.cash -= totalCost;
      this.positions.set(symbol, {
        symbol,
        qty,
        buyPrice: price,
        maxPriceAfterBuy: price,
        buyOpenTime: decision.candleOpenTime,
      });
    } else {
      const position = this.positions.get(symbol);
      if (!position) {
        return false;
      }

      const buyPrice = position.buyPrice;
      const maxPriceAfterBuy =
        decision.updatedMaxPrice ??
        position.maxPriceAfterBuy ??
        position.buyPrice;
      const realizedPnlPct = pnlPercentFromPrices(buyPrice, price);

      this.cash += notional - fee;
      this.positions.delete(symbol);
      this.lastSellOpenTime.set(symbol, decision.candleOpenTime);

      this.trades.push({
        symbol,
        side: decision.action,
        qty,
        price,
        notional,
        fee,
        candleOpenTime: decision.candleOpenTime,
        reason: decision.reason,
        openPrice: buyPrice,
        closePrice: price,
        maxPriceAfterBuy,
        realizedPnlPct,
        ...(params.postClose24h ?? NULL_TRADE_POST_CLOSE_24H),
      });

      return true;
    }

    this.trades.push({
      symbol,
      side: decision.action,
      qty,
      price,
      notional,
      fee,
      candleOpenTime: decision.candleOpenTime,
      reason: decision.reason,
      openPrice: price,
      closePrice: null,
      maxPriceAfterBuy: price,
      realizedPnlPct: null,
      ...NULL_TRADE_POST_CLOSE_24H,
    });

    return true;
  }

  getMarkPrices(params: {
    symbol: string;
    close: number;
  }): Map<string, number> {
    const prices = new Map<string, number>();
    for (const symbol of this.positions.keys()) {
      prices.set(symbol, params.symbol === symbol ? params.close : 0);
    }
    return prices;
  }

  getEquity(markPrices: Map<string, number>): number {
    let equity = this.cash;

    for (const [symbol, position] of this.positions) {
      const price = markPrices.get(symbol);
      if (price !== undefined && price > 0) {
        equity += position.qty * price;
      }
    }

    return equity;
  }
}
