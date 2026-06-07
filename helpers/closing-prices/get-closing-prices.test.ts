import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/binance/get-usdt-symbols");
vi.mock("@/utils/binance/get-closing-price");
vi.mock("@/utils/binance/is-usdt-symbol", () => ({
  isUsdtSymbol: (symbol: string) => symbol.endsWith("USDT"),
}));

import { getClosingPrice } from "@/utils/binance/get-closing-price";
import { getUsdtSymbols } from "@/utils/binance/get-usdt-symbols";

import { InvalidSymbolsError } from "./invalid-symbols-error";
import { getClosingPrices } from "./get-closing-prices";

const mockedGetUsdtSymbols = vi.mocked(getUsdtSymbols);
const mockedGetClosingPrice = vi.mocked(getClosingPrice);

describe("getClosingPrices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetUsdtSymbols.mockResolvedValue(["BTCUSDT", "ETHUSDT"]);
    mockedGetClosingPrice.mockImplementation(async ({ symbol }) =>
      symbol === "BTCUSDT" ? "50000" : "3000",
    );
  });

  it("returns closing prices for all USDT symbols and intervals", async () => {
    const result = await getClosingPrices({ intervals: ["H1"] });

    expect(result.intervals).toEqual(["H1"]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      symbol: "BTCUSDT",
      prices: { H1: "50000" },
    });
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("filters to requested symbols when filter is valid", async () => {
    const result = await getClosingPrices({
      intervals: ["H1"],
      symbolsFilter: ["ETHUSDT"],
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.symbol).toBe("ETHUSDT");
    expect(mockedGetClosingPrice).toHaveBeenCalledTimes(1);
  });

  it("throws InvalidSymbolsError for unknown symbols", async () => {
    await expect(
      getClosingPrices({
        intervals: ["H1"],
        symbolsFilter: ["NOTUSDT"],
      }),
    ).rejects.toBeInstanceOf(InvalidSymbolsError);
  });

  it("throws InvalidSymbolsError for non-USDT symbols", async () => {
    await expect(
      getClosingPrices({
        intervals: ["H1"],
        symbolsFilter: ["BTCBUSD"],
      }),
    ).rejects.toBeInstanceOf(InvalidSymbolsError);
  });

  it("omits intervals where closing price is null", async () => {
    mockedGetClosingPrice.mockResolvedValue(null);

    const result = await getClosingPrices({ intervals: ["H1"] });
    expect(
      result.data.every((row) => Object.keys(row.prices).length === 0),
    ).toBe(true);
  });
});
