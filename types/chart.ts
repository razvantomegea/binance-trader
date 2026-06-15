export type ChartMarkerKind = "entry" | "exit";

export interface ChartMarker {
  kind: ChartMarkerKind;
  /** H1 candle open time in ms (from trade.candleOpenTime or position.buyTime) */
  openTimeMs: number;
  price: number;
  /** Dedup key, e.g. trade id or "position-{buyTradeId}" */
  id: string;
}

export interface ChartPoint {
  openTimeMs: number;
  time: string;
  close: number;
}

export interface SnappedChartMarker {
  x: string;
  y: number;
  kind: ChartMarkerKind;
  id: string;
}
