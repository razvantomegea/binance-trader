import { describe, expect, it } from "vitest";

import { pnlPercentFromPrices } from "./pnl-percent";

describe("pnlPercentFromPrices", () => {
  it("returns null when buyPrice is zero", () => {
    expect(pnlPercentFromPrices(0, 100)).toBeNull();
  });

  it("returns null when buyPrice is not finite", () => {
    expect(pnlPercentFromPrices(Number.NaN, 100)).toBeNull();
    expect(pnlPercentFromPrices(Number.POSITIVE_INFINITY, 100)).toBeNull();
  });

  it("computes positive PnL percent", () => {
    expect(pnlPercentFromPrices(100, 150)).toBe(50);
  });

  it("computes negative PnL percent", () => {
    expect(pnlPercentFromPrices(100, 75)).toBe(-25);
  });

  it("returns zero when prices are equal", () => {
    expect(pnlPercentFromPrices(200, 200)).toBe(0);
  });
});
