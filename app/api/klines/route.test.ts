import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/binance/get-klines");

import { getKlines } from "@/utils/binance/get-klines";

import { GET } from "./route";

const mockedGetKlines = vi.mocked(getKlines);

const BASE_URL = "http://test.local/api/klines";

describe("GET /api/klines", () => {
  beforeEach(() => {
    mockedGetKlines.mockReset();
  });

  it("returns 400 when symbol is missing", async () => {
    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "symbol is required",
    });
  });

  it("returns 400 for non-USDT symbol", async () => {
    const response = await GET(new Request(`${BASE_URL}?symbol=BTCETH`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only symbols ending with USDT are allowed",
    });
  });

  it("returns 400 for invalid interval", async () => {
    const response = await GET(
      new Request(`${BASE_URL}?symbol=BTCUSDT&interval=M1`),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid interval",
    });
  });

  it("returns 502 when getKlines throws Error", async () => {
    mockedGetKlines.mockRejectedValue(new Error("Binance unavailable"));

    const response = await GET(new Request(`${BASE_URL}?symbol=BTCUSDT`));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Binance unavailable",
    });
  });

  it("returns 500 when getKlines throws non-Error", async () => {
    mockedGetKlines.mockRejectedValue("unexpected");

    const response = await GET(new Request(`${BASE_URL}?symbol=BTCUSDT`));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch klines",
    });
  });

  it("returns 200 with candles on success", async () => {
    const candles = [{ openTime: 1, open: 1, high: 2, low: 1, close: 2 }];
    mockedGetKlines.mockResolvedValue(candles);

    const response = await GET(
      new Request(`${BASE_URL}?symbol=btcusdt&interval=H1&limit=50`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      symbol: "BTCUSDT",
      interval: "H1",
      candles,
    });
    expect(mockedGetKlines).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      interval: "H1",
      limit: 50,
    });
  });
});
