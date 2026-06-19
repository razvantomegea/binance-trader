import { describe, expect, it } from "vitest";

import { resolveBinanceApiBaseUrl } from "./binance";

describe("BINANCE_API_BASE_URL", () => {
  it("uses the configured base URL when env is set", () => {
    expect(resolveBinanceApiBaseUrl(" https://custom.binance.test ")).toBe(
      "https://custom.binance.test",
    );
  });

  it("falls back to the public data API when env is empty", () => {
    expect(resolveBinanceApiBaseUrl("   ")).toBe(
      "https://data-api.binance.vision",
    );
  });
});
