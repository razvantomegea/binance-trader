import { sendTradeExecutedPush } from "@/helpers/notifications/web-push";
import type { TradeExecutedPushPayload } from "@/helpers/notifications/types";
import type { TradeSide } from "@/types/portfolio";

export interface NotifyTradeExecutedParams {
  tradeId: number;
  symbol: string;
  side: TradeSide;
  qty: number;
  price: number;
  reason: string;
  interval: string;
}

export function buildTradeExecutedPayload({
  tradeId,
  symbol,
  side,
  qty,
  price,
  reason,
  interval,
}: NotifyTradeExecutedParams): TradeExecutedPushPayload {
  return {
    title: `Trade executed: ${side} ${symbol}`,
    body: `${side} ${qty} @ ${price} · ${reason} (${interval})`,
    data: { tradeId, symbol, side, reason },
  };
}

export function notifyTradeExecuted(params: NotifyTradeExecutedParams): void {
  const payload = buildTradeExecutedPayload(params);
  void sendTradeExecutedPush(payload).catch((err) => {
    console.error("notifyTradeExecuted failed", err);
  });
}
