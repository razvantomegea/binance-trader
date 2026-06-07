import { describe, expect, it } from "vitest";

import { STRATEGY_CRON_INTERVAL_MS } from "@/constants/cron";

import { computeNextStrategyCronRunIso } from "./compute-next-cron-run";

describe("computeNextStrategyCronRunIso", () => {
  it("returns next 5-minute UTC boundary", () => {
    const tsMs = Date.parse("2026-06-07T12:03:45.000Z");

    expect(computeNextStrategyCronRunIso(tsMs)).toBe(
      "2026-06-07T12:05:00.000Z",
    );
  });

  it("advances to next slot when timestamp is exactly on boundary", () => {
    const tsMs = Date.parse("2026-06-07T12:05:00.000Z");

    expect(computeNextStrategyCronRunIso(tsMs)).toBe(
      "2026-06-07T12:10:00.000Z",
    );
  });

  it("uses configured interval length", () => {
    const intervalStartMs =
      Math.floor(1_700_000_000_000 / STRATEGY_CRON_INTERVAL_MS) *
      STRATEGY_CRON_INTERVAL_MS;

    expect(computeNextStrategyCronRunIso(1_700_000_000_000)).toBe(
      new Date(intervalStartMs + STRATEGY_CRON_INTERVAL_MS).toISOString(),
    );
  });
});
