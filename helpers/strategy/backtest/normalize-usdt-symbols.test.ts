import { describe, expect, it } from "vitest";

import { normalizeAndValidateUsdtSymbols } from "./normalize-usdt-symbols";

describe("normalizeAndValidateUsdtSymbols", () => {
  it("normalizes, dedupes, and sorts symbols", () => {
    expect(
      normalizeAndValidateUsdtSymbols([" ethusdt ", "BTCUSDT", "ethusdt"]),
    ).toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("throws when all symbols are empty after trim", () => {
    expect(() => normalizeAndValidateUsdtSymbols([" ", ""])).toThrow(
      /at least one non-empty USDT symbol/,
    );
  });

  it("throws when USDT quote asset is used as symbol", () => {
    expect(() => normalizeAndValidateUsdtSymbols(["USDT"])).toThrow(
      /Invalid symbol "USDT"/,
    );
  });

  it("throws for non-USDT pairs", () => {
    expect(() => normalizeAndValidateUsdtSymbols(["ETHBTC"])).toThrow(
      /Only USDT symbols are allowed/,
    );
  });

  it("throws when no valid symbols remain", () => {
    expect(() => normalizeAndValidateUsdtSymbols([])).toThrow(
      /at least one valid USDT symbol/,
    );
  });
});
