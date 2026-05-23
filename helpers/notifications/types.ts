import type { TradeSide } from "@/types/portfolio";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

export interface TradeExecutedPushData {
  tradeId: number;
  symbol: string;
  side: TradeSide;
  reason: string;
}

export interface TradeExecutedPushPayload {
  title: string;
  body: string;
  data: TradeExecutedPushData;
}
