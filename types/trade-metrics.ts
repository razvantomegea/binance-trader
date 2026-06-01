/** Post-close extrema within up to 24h after SELL (excludes SELL candle). */
export interface TradePostClose24hMetrics {
  maxPriceAfterClose24h: number | null;
  minPriceAfterClose24h: number | null;
  maxPriceAfterClose24hPct: number | null;
  minPriceAfterClose24hPct: number | null;
}

export const NULL_TRADE_POST_CLOSE_24H: TradePostClose24hMetrics = {
  maxPriceAfterClose24h: null,
  minPriceAfterClose24h: null,
  maxPriceAfterClose24hPct: null,
  minPriceAfterClose24hPct: null,
};

export const POST_CLOSE_WINDOW_CANDLES = 24;
