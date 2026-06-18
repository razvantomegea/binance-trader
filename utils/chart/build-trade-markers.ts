import type { ChartMarker } from "@/types/chart";
import type { PositionRow, TradeRow } from "@/types/portfolio";

interface BuildTradeMarkersParams {
  symbol: string;
  trades: TradeRow[];
  positions: PositionRow[];
}

function parseOpenTimeMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrice(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tradeToMarker(row: TradeRow): ChartMarker | null {
  const openTimeMs = parseOpenTimeMs(row.candleOpenTime);
  const price = parsePrice(row.price);
  if (openTimeMs === null || price === null) {
    return null;
  }

  return {
    kind: row.side === "BUY" ? "entry" : "exit",
    openTimeMs,
    price,
    id: String(row.id),
  };
}

function positionToMarker(position: PositionRow): ChartMarker | null {
  const openTimeMs = parseOpenTimeMs(position.buyTime);
  const price = parsePrice(position.buyPrice);
  if (openTimeMs === null || price === null) {
    return null;
  }

  return {
    kind: "entry",
    openTimeMs,
    price,
    id: `position-${position.buyTradeId}`,
  };
}

export function buildTradeMarkers({
  symbol,
  trades,
  positions,
}: BuildTradeMarkersParams): ChartMarker[] {
  const markers: ChartMarker[] = trades
    .filter((row) => row.symbol === symbol)
    .map(tradeToMarker)
    .filter((marker): marker is ChartMarker => marker !== null);

  const entryTradeIds = new Set(
    markers.filter((m) => m.kind === "entry").map((m) => m.id),
  );

  const position = positions.find((row) => row.symbol === symbol);
  if (position) {
    const positionMarker = positionToMarker(position);
    if (positionMarker && !entryTradeIds.has(String(position.buyTradeId))) {
      markers.push(positionMarker);
    }
  }

  return markers;
}
