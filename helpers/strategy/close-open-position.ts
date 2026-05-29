import { eq } from "drizzle-orm";

import { STRATEGY_INTERVAL } from "@/constants/strategy";
import { getDb } from "@/db";
import { positions } from "@/db/schema";
import { placeTrade } from "@/helpers/strategy/place-trade";
import { getLatestClosedKline } from "@/utils/binance/get-klines";
import { parseFiniteNumber } from "@/utils/parse-finite-number";

export class PositionNotFoundError extends Error {
  constructor(symbol: string) {
    super(`No open position for ${symbol}`);
    this.name = "PositionNotFoundError";
  }
}

interface CloseOpenPositionParams {
  symbol: string;
}

export async function closeOpenPosition({
  symbol,
}: CloseOpenPositionParams): Promise<void> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error("symbol is required");
  }

  const [row] = await getDb()
    .select()
    .from(positions)
    .where(eq(positions.symbol, normalized))
    .limit(1);

  if (!row) {
    throw new PositionNotFoundError(normalized);
  }

  const candle = await getLatestClosedKline({
    symbol: normalized,
    interval: STRATEGY_INTERVAL,
  });

  if (!candle || !Number.isFinite(candle.close) || candle.close <= 0) {
    throw new Error(`No valid closed candle for ${normalized}`);
  }

  await placeTrade({
    symbol: normalized,
    side: "SELL",
    qty: parseFiniteNumber(row.qty),
    price: candle.close,
    interval: STRATEGY_INTERVAL,
    candleOpenTime: candle.openTime,
    reason: "manual_close",
  });
}
