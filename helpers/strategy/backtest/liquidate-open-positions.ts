import { TRAILING_STOP_PCT } from "@/constants/binance";
import type { SimulatedLedger } from "@/helpers/strategy/backtest/simulated-ledger";
import type { EvaluateDecisionResult } from "@/helpers/strategy/decision-core";
import { resolveTrailingSellPrice } from "@/utils/strategy/trailing-stop";

export const EXIT_PORTFOLIO_DRAWDOWN_REASON = `exit_portfolio_drawdown_${TRAILING_STOP_PCT * 100}pct_while_open`;

export function liquidateAllOpenPositions(params: {
  ledger: SimulatedLedger;
  markPrices: Map<string, number>;
  candleOpenTime: number;
  reason?: string;
  trailingStopPct?: number;
}): void {
  const reason = params.reason ?? EXIT_PORTFOLIO_DRAWDOWN_REASON;
  const trailingStopPct = params.trailingStopPct ?? TRAILING_STOP_PCT;

  for (const symbol of [...params.ledger.positions.keys()]) {
    const position = params.ledger.positions.get(symbol);
    if (!position) {
      continue;
    }

    const mark = params.markPrices.get(symbol) ?? position.buyPrice;
    const sellPrice = resolveTrailingSellPrice({
      position: {
        buyPrice: position.buyPrice,
        maxPriceAfterBuy: position.maxPriceAfterBuy,
      },
      marketPrice: mark,
      thresholdPct: trailingStopPct,
    });

    const decision: EvaluateDecisionResult = {
      action: "SELL",
      candleOpenTime: params.candleOpenTime,
      reason,
      qty: position.qty,
    };

    params.ledger.applyDecision({
      symbol,
      decision,
      price: sellPrice,
    });
  }
}
