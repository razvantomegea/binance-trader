import type { ChartMarker } from "@/types/chart";
import type { PositionRow, TradeRow } from "@/types/portfolio";

interface BuildTradeMarkersParams {
  symbol: string;
  trades: TradeRow[];
  positions: PositionRow[];
}

function tradeToMarker(row: TradeRow): ChartMarker {
  return {
    kind: row.side === "BUY" ? "entry" : "exit",
    openTimeMs: Date.parse(row.candleOpenTime),
    price: Number(row.price),
    id: String(row.id),
  };
}

export function buildTradeMarkers({
  symbol,
  trades,
  positions,
}: BuildTradeMarkersParams): ChartMarker[] {
  const markers: ChartMarker[] = trades
    .filter((row) => row.symbol === symbol)
    .map(tradeToMarker);

  const entryTradeIds = new Set(
    markers.filter((m) => m.kind === "entry").map((m) => m.id),
  );

  const position = positions.find((row) => row.symbol === symbol);
  if (position && !entryTradeIds.has(String(position.buyTradeId))) {
    markers.push({
      kind: "entry",
      openTimeMs: Date.parse(position.buyTime),
      price: Number(position.buyPrice),
      id: `position-${position.buyTradeId}`,
    });
  }

  return markers;
}
