import type { SimTrade } from "@/types/backtest";
import type { DecisionPositionState } from "@/helpers/strategy/decision-core";
import type { EvaluateDecisionResult } from "@/helpers/strategy/decision-core";
import {
  NULL_TRADE_POST_CLOSE_24H,
  type TradePostClose24hMetrics,
} from "@/types/trade-metrics";
import { pnlPercentFromPrices } from "@/utils/pnl-percent";

interface SimPosition {
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
      decision.qty === undefined ||
      decision.candleOpenTime === null ||
      decision.reason === undefined
    ) {
      return false;
    }

    const tradeAction = decision.action;
    const { qty } = decision;
    const notional = qty * price;
    const fee = (notional * this.feeBps) / 10_000;

    if (tradeAction === "BUY") {
      return this.applyBuyDecision({
        symbol,
        candleOpenTime: decision.candleOpenTime,
        reason: decision.reason,
        qty,
        price,
        notional,
        fee,
      });
    }

    return this.applySellDecision({
      symbol,
      candleOpenTime: decision.candleOpenTime,
      reason: decision.reason,
      updatedMaxPrice: decision.updatedMaxPrice,
      qty,
      price,
      notional,
      fee,
      postClose24h: params.postClose24h,
    });
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

  private applyBuyDecision(params: {
    symbol: string;
    candleOpenTime: number;
    reason: string;
    qty: number;
    price: number;
    notional: number;
    fee: number;
  }): boolean {
    const totalCost = params.notional + params.fee;
    if (totalCost > this.cash) {
      return false;
    }

    this.cash -= totalCost;
    this.positions.set(params.symbol, {
      symbol: params.symbol,
      qty: params.qty,
      buyPrice: params.price,
      maxPriceAfterBuy: params.price,
      buyOpenTime: params.candleOpenTime,
    });
    this.trades.push({
      symbol: params.symbol,
      side: "BUY",
      qty: params.qty,
      price: params.price,
      notional: params.notional,
      fee: params.fee,
      candleOpenTime: params.candleOpenTime,
      reason: params.reason,
      openPrice: params.price,
      closePrice: null,
      maxPriceAfterBuy: params.price,
      realizedPnlPct: null,
      ...NULL_TRADE_POST_CLOSE_24H,
    });
    return true;
  }

  private applySellDecision(params: {
    symbol: string;
    candleOpenTime: number;
    reason: string;
    updatedMaxPrice?: number;
    qty: number;
    price: number;
    notional: number;
    fee: number;
    postClose24h?: TradePostClose24hMetrics;
  }): boolean {
    const position = this.positions.get(params.symbol);
    if (!position) {
      return false;
    }

    const maxPriceAfterBuy =
      params.updatedMaxPrice ?? position.maxPriceAfterBuy ?? position.buyPrice;
    const realizedPnlPct = pnlPercentFromPrices(
      position.buyPrice,
      params.price,
    );

    this.cash += params.notional - params.fee;
    this.positions.delete(params.symbol);
    this.lastSellOpenTime.set(params.symbol, params.candleOpenTime);
    this.trades.push({
      symbol: params.symbol,
      side: "SELL",
      qty: params.qty,
      price: params.price,
      notional: params.notional,
      fee: params.fee,
      candleOpenTime: params.candleOpenTime,
      reason: params.reason,
      openPrice: position.buyPrice,
      closePrice: params.price,
      maxPriceAfterBuy,
      realizedPnlPct,
      ...(params.postClose24h ?? NULL_TRADE_POST_CLOSE_24H),
    });
    return true;
  }
}
