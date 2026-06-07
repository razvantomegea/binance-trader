import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTradingSymbols, getUsdtSymbols } from "./get-usdt-symbols";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

function exchangeInfoResponse(
  symbols: Array<{
    symbol: string;
    quoteAsset: string;
    status: string;
  }>,
) {
  return new Response(JSON.stringify({ symbols }), { status: 200 });
}

describe("getUsdtSymbols", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("filters trading USDT pairs and sorts", async () => {
    mockFetch.mockResolvedValueOnce(
      exchangeInfoResponse([
        { symbol: "ETHUSDT", quoteAsset: "USDT", status: "TRADING" },
        { symbol: "BTCUSDT", quoteAsset: "USDT", status: "TRADING" },
        { symbol: "ETHBTC", quoteAsset: "BTC", status: "TRADING" },
        { symbol: "XRPUSDT", quoteAsset: "USDT", status: "BREAK" },
        { symbol: "USDT", quoteAsset: "USDT", status: "TRADING" },
      ]),
    );

    await expect(getUsdtSymbols()).resolves.toEqual(["BTCUSDT", "ETHUSDT"]);
  });

  it("throws when exchange info request fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 503 }));

    await expect(getUsdtSymbols()).rejects.toThrow(
      "Failed to fetch symbols from Binance",
    );
  });

  it("getTradingSymbols delegates to getUsdtSymbols", async () => {
    mockFetch.mockResolvedValueOnce(
      exchangeInfoResponse([
        { symbol: "ADAUSDT", quoteAsset: "USDT", status: "TRADING" },
      ]),
    );

    await expect(getTradingSymbols()).resolves.toEqual(["ADAUSDT"]);
  });
});
