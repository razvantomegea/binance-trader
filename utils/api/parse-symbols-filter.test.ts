import { describe, expect, it } from "vitest";

import { parseSymbolsFilter } from "./parse-symbols-filter";

describe("parseSymbolsFilter", () => {
  it("returns undefined for null", () => {
    expect(parseSymbolsFilter(null)).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseSymbolsFilter("")).toBeUndefined();
  });

  it("parses and uppercases comma-separated symbols", () => {
    expect(parseSymbolsFilter("btcusdt, ethusdt")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
    ]);
  });

  it("trims whitespace around symbols", () => {
    expect(parseSymbolsFilter("  btcusdt  ")).toEqual(["BTCUSDT"]);
  });

  it("returns undefined when only separators remain", () => {
    expect(parseSymbolsFilter(" , , ")).toBeUndefined();
  });
});
