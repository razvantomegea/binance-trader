import { describe, expect, it } from "vitest";

import { CANDLE_INTERVALS } from "@/constants/binance";

import { parseCandleIntervals } from "./parse-candle-intervals";

describe("parseCandleIntervals", () => {
  it("returns all intervals when value is null", () => {
    expect(parseCandleIntervals(null)).toEqual([...CANDLE_INTERVALS]);
  });

  it("parses valid comma-separated intervals", () => {
    expect(parseCandleIntervals("h1,h1")).toEqual(["H1", "H1"]);
  });

  it("returns null when any interval is invalid", () => {
    expect(parseCandleIntervals("H1,M5")).toBeNull();
  });

  it("returns null for empty tokens after invalid split", () => {
    expect(parseCandleIntervals("M5")).toBeNull();
  });
});
