import { describe, expect, it } from "vitest";

import { STRATEGY_DESCRIPTION } from "./strategy-description";

describe("STRATEGY_DESCRIPTION", () => {
  it("describes the paper strategy with formatted percentages", () => {
    expect(STRATEGY_DESCRIPTION).toContain("H1 paper strategy");
    expect(STRATEGY_DESCRIPTION).toContain("entry:");
    expect(STRATEGY_DESCRIPTION).toMatch(/\d+(\.\d+)?%/);
  });
});
