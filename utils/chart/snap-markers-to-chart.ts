import type {
  ChartMarker,
  ChartPoint,
  SnappedChartMarker,
} from "@/types/chart";

interface SnapMarkersToChartParams {
  markers: ChartMarker[];
  points: ChartPoint[];
}

export function snapMarkersToChart({
  markers,
  points,
}: SnapMarkersToChartParams): SnappedChartMarker[] {
  const openTimeToLabel = new Map(
    points.map((point) => [point.openTimeMs, point.time]),
  );

  const snapped: SnappedChartMarker[] = [];

  for (const marker of markers) {
    const x = openTimeToLabel.get(marker.openTimeMs);
    if (x === undefined) {
      continue;
    }
    snapped.push({
      x,
      y: marker.price,
      kind: marker.kind,
      id: marker.id,
    });
  }

  return snapped;
}
