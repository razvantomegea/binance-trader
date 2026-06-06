import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { positions, trades } from "@/db/schema";
import { ENTRY_RANGE_MAX_PCT, ENTRY_RANGE_PCT } from "@/constants/binance";
import {
  STRATEGY_INTERVAL,
  STRATEGY_LOOKBACK_CLOSES,
} from "@/constants/strategy";
import {
  evaluateDecision,
  get24hHighLow,
  getCloseHighLow,
} from "@/helpers/strategy/decision-core";
import { HOUR_MS } from "@/utils/binance/candle-time";
import {
  getHistoricalClosedKlines,
  getRecentClosedKlines,
} from "@/utils/binance/get-klines";
import { isGainWithinBand } from "@/utils/strategy/price-change-conditions";
import type { CandleSlice } from "@/helpers/strategy/decision-core";

const SYMBOL = "ZECUSDT";

function diagnose(closed: CandleSlice[], label: string) {
  const latest = closed[0]!;
  const { high24h, low24h, highOpenTime, lowOpenTime } = get24hHighLow(closed);
  const { highClose, lowClose } = getCloseHighLow(closed);
  const bandMin = lowClose * (1 + ENTRY_RANGE_PCT);
  const bandMax = lowClose * (1 + ENTRY_RANGE_MAX_PCT);
  const closeInBand = isGainWithinBand({
    value: latest.close,
    ref: lowClose,
    minPct: ENTRY_RANGE_PCT,
    maxPct: ENTRY_RANGE_MAX_PCT,
  });
  const highInBand = isGainWithinBand({
    value: highClose,
    ref: lowClose,
    minPct: ENTRY_RANGE_PCT,
    maxPct: ENTRY_RANGE_MAX_PCT,
  });

  const decision = evaluateDecision({
    closed,
    position: undefined,
    cash: 10_000,
    lastProcessedOpenTime: null,
    lastSellOpenTime: null,
    markPrice: latest.close,
  });

  return {
    label,
    action: decision.action,
    windowLen: closed.length,
    latestOpenTime: new Date(latest.openTime).toISOString(),
    windowOldestOpenTime: new Date(
      closed[closed.length - 1]!.openTime,
    ).toISOString(),
    close: latest.close,
    high24h,
    low24h,
    highOpenTime: new Date(highOpenTime).toISOString(),
    lowOpenTime: new Date(lowOpenTime).toISOString(),
    highClose,
    lowClose,
    bandMin,
    bandMax,
    closeInBand,
    highInBand,
    closeGainVsLowClose:
      lowClose > 0 ? (latest.close - lowClose) / lowClose : null,
    highGainVsLowClose: lowClose > 0 ? (highClose - lowClose) / lowClose : null,
  };
}

export async function GET() {
  const db = getDb();
  const [pos] = await db
    .select()
    .from(positions)
    .where(eq(positions.symbol, SYMBOL));
  const buyTrades = await db
    .select()
    .from(trades)
    .where(eq(trades.symbol, SYMBOL));

  const buyTradeRow = buyTrades.find((t) => t.side === "BUY");
  const buyOpenTimeMs = pos
    ? pos.buyTime.getTime()
    : buyTradeRow
      ? buyTradeRow.candleOpenTime.getTime()
      : null;

  // Reconstruct the window as it was at buy time.
  let atBuy: ReturnType<typeof diagnose> | null = null;
  if (buyOpenTimeMs !== null) {
    const histAsc = await getHistoricalClosedKlines({
      symbol: SYMBOL,
      interval: STRATEGY_INTERVAL,
      startTime: buyOpenTimeMs - (STRATEGY_LOOKBACK_CLOSES + 2) * HOUR_MS,
      endTime: buyOpenTimeMs,
    });
    const upToBuy = histAsc.filter((c) => c.openTime <= buyOpenTimeMs);
    const window = upToBuy.slice(-STRATEGY_LOOKBACK_CLOSES).reverse();
    if (window.length === STRATEGY_LOOKBACK_CLOSES) {
      atBuy = diagnose(window, "at_buy");
    }
  }

  // Live current window for comparison.
  const liveClosed = await getRecentClosedKlines({
    symbol: SYMBOL,
    interval: STRATEGY_INTERVAL,
    count: STRATEGY_LOOKBACK_CLOSES,
  });
  const live =
    liveClosed.length === STRATEGY_LOOKBACK_CLOSES
      ? diagnose(liveClosed, "live_now")
      : null;

  const payload = {
    dbPosition: pos
      ? {
          buyPrice: pos.buyPrice,
          qty: pos.qty,
          maxPriceAfterBuy: pos.maxPriceAfterBuy,
          buyTime: pos.buyTime.toISOString(),
        }
      : null,
    buyTrade: buyTradeRow
      ? {
          price: buyTradeRow.price,
          reason: buyTradeRow.reason,
          candleOpenTime: buyTradeRow.candleOpenTime.toISOString(),
        }
      : null,
    atBuy,
    live,
  };

  // #region agent log
  fetch("http://127.0.0.1:7441/ingest/ab258800-65a4-4178-a40e-0e355625dde2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "425899",
    },
    body: JSON.stringify({
      sessionId: "425899",
      hypothesisId: "H1-H5",
      location: "debug/zec-entry/route.ts",
      message: "ZEC entry reconstruction (DB + live Binance)",
      data: payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json(payload);
}
