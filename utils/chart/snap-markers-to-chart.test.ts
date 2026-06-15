import { describe, expect, it } from "vitest";

import type { ChartMarker, ChartPoint } from "@/types/chart";

import { snapMarkersToChart } from "./snap-markers-to-chart";

const chartPoints: ChartPoint[] = [
  {
    openTimeMs: Date.parse("2026-06-07T08:00:00.000Z"),
    time: "6/7/2026, 8:00:00 AM",
    close: 2800,
  },
  {
    openTimeMs: Date.parse("2026-06-07T09:00:00.000Z"),
    time: "6/7/2026, 9:00:00 AM",
    close: 3000,
  },
];

describe("snapMarkersToChart", () => {
  it("snaps markers to matching chart point labels", () => {
    const markers: ChartMarker[] = [
      {
        kind: "entry",
        openTimeMs: Date.parse("2026-06-07T08:00:00.000Z"),
        price: 2795,
        id: "1",
      },
      {
        kind: "exit",
        openTimeMs: Date.parse("2026-06-07T09:00:00.000Z"),
        price: 3005,
        id: "2",
      },
    ];

    expect(snapMarkersToChart({ markers, points: chartPoints })).toEqual([
      {
        x: "6/7/2026, 8:00:00 AM",
        y: 2795,
        kind: "entry",
        id: "1",
      },
      {
        x: "6/7/2026, 9:00:00 AM",
        y: 3005,
        kind: "exit",
        id: "2",
      },
    ]);
  });

  it("drops markers outside the loaded candle window", () => {
    const markers: ChartMarker[] = [
      {
        kind: "entry",
        openTimeMs: Date.parse("2026-06-01T08:00:00.000Z"),
        price: 2500,
        id: "old",
      },
    ];

    expect(snapMarkersToChart({ markers, points: chartPoints })).toEqual([]);
  });
});
