import { describe, expect, it } from "vitest";

import { mapPostClose24hFromDb } from "./map-post-close-24h-fields";

describe("mapPostClose24hFromDb", () => {
  it("parses numeric strings to numbers", () => {
    expect(
      mapPostClose24hFromDb({
        maxPriceAfterClose24h: "110.5",
        minPriceAfterClose24h: "95.25",
        maxPriceAfterClose24hPct: "5.5",
        minPriceAfterClose24hPct: "-2.1",
      }),
    ).toEqual({
      maxPriceAfterClose24h: 110.5,
      minPriceAfterClose24h: 95.25,
      maxPriceAfterClose24hPct: 5.5,
      minPriceAfterClose24hPct: -2.1,
    });
  });

  it("returns null fields when db values are null", () => {
    expect(
      mapPostClose24hFromDb({
        maxPriceAfterClose24h: null,
        minPriceAfterClose24h: null,
        maxPriceAfterClose24hPct: null,
        minPriceAfterClose24hPct: null,
      }),
    ).toEqual({
      maxPriceAfterClose24h: null,
      minPriceAfterClose24h: null,
      maxPriceAfterClose24hPct: null,
      minPriceAfterClose24hPct: null,
    });
  });

  it("maps invalid numeric strings to zero via parseFiniteNumber", () => {
    expect(
      mapPostClose24hFromDb({
        maxPriceAfterClose24h: "not-a-number",
        minPriceAfterClose24h: "NaN",
        maxPriceAfterClose24hPct: "Infinity",
        minPriceAfterClose24hPct: "-Infinity",
      }),
    ).toEqual({
      maxPriceAfterClose24h: 0,
      minPriceAfterClose24h: 0,
      maxPriceAfterClose24hPct: 0,
      minPriceAfterClose24hPct: 0,
    });
  });
});
