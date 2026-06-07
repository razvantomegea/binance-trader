import { afterEach, describe, expect, it, vi } from "vitest";

describe("BINANCE_API_BASE_URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the configured base URL when env is set", async () => {
    vi.stubEnv("BINANCE_API_BASE_URL", " https://custom.binance.test ");

    const { BINANCE_API_BASE_URL } = await import("./binance");

    expect(BINANCE_API_BASE_URL).toBe("https://custom.binance.test");
  });

  it("falls back to the public data API when env is empty", async () => {
    vi.stubEnv("BINANCE_API_BASE_URL", "   ");

    const { BINANCE_API_BASE_URL } = await import("./binance");

    expect(BINANCE_API_BASE_URL).toBe("https://data-api.binance.vision");
  });
});
