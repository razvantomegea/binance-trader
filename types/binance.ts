export interface BinanceExchangeSymbol {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface BinanceExchangeInfoResponse {
  symbols: BinanceExchangeSymbol[];
}

export type CandleInterval = "H1";

export interface KlineCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Binance kline: [openTime, open, high, low, close, ...] */
export type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  ...unknown[],
];

export interface SymbolClosingPrices {
  symbol: string;
  prices: Partial<Record<CandleInterval, string>>;
}

export interface ClosingPricesResponse {
  intervals: CandleInterval[];
  updatedAt: string;
  data: SymbolClosingPrices[];
}
