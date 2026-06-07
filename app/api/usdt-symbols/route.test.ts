import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/binance/get-usdt-symbols");

import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";

import { GET } from "./route";

const mockedGetUsdtSymbols = vi.mocked(getUsdtSymbols);

describe("GET /api/usdt-symbols", () => {
  beforeEach(() => {
    mockedGetUsdtSymbols.mockReset();
  });

  it("returns 502 when symbol fetch fails", async () => {
    mockedGetUsdtSymbols.mockRejectedValue(new Error("binance down"));

    const response = await GET();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch symbols from Binance",
    });
  });

  it("returns 200 with symbols list", async () => {
    mockedGetUsdtSymbols.mockResolvedValue(["BTCUSDT", "ETHUSDT"]);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      symbols: ["BTCUSDT", "ETHUSDT"],
    });
  });
});
