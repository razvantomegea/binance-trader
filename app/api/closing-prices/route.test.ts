import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/closing-prices/get-closing-prices");
vi.mock("@/utils/api/parse-symbols-filter");

import { InvalidSymbolsError } from "@/helpers/closing-prices/invalid-symbols-error";
import { getClosingPrices } from "@/helpers/closing-prices/get-closing-prices";
import { parseSymbolsFilter } from "@/utils/api/parse-symbols-filter";

import { GET } from "./route";

const mockedGetClosingPrices = vi.mocked(getClosingPrices);
const mockedParseSymbolsFilter = vi.mocked(parseSymbolsFilter);

const BASE_URL = "http://test.local/api/closing-prices";

describe("GET /api/closing-prices", () => {
  beforeEach(() => {
    mockedGetClosingPrices.mockReset();
    mockedParseSymbolsFilter.mockReset();
    mockedParseSymbolsFilter.mockImplementation((value) => {
      if (value === "!!!") {
        throw new Error("bad symbols");
      }
      return value ? [value.toUpperCase()] : undefined;
    });
  });

  it("returns 400 for invalid intervals", async () => {
    const response = await GET(new Request(`${BASE_URL}?intervals=M1`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid intervals. Supported: H1",
    });
  });

  it("returns 400 for invalid symbols filter", async () => {
    const response = await GET(new Request(`${BASE_URL}?symbols=!!!`));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/^Invalid symbols filter:/);
  });

  it("returns generic symbols filter message for non-Error throws", async () => {
    mockedParseSymbolsFilter.mockImplementation(() => {
      throw "bad symbols";
    });

    const response = await GET(new Request(`${BASE_URL}?symbols=BTCUSDT`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid symbols filter: Invalid symbols filter",
    });
  });

  it("returns 400 when helper throws InvalidSymbolsError", async () => {
    mockedGetClosingPrices.mockRejectedValue(
      new InvalidSymbolsError(["FAKEUSDT"]),
    );

    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Unknown or inactive symbols: FAKEUSDT",
    });
  });

  it("returns 502 when helper throws generic error", async () => {
    mockedGetClosingPrices.mockRejectedValue(new Error("binance down"));

    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch symbols from Binance",
    });
  });

  it("accepts explicit H1 intervals parameter", async () => {
    const payload: Awaited<ReturnType<typeof getClosingPrices>> = {
      intervals: ["H1"],
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: [],
    };
    mockedGetClosingPrices.mockResolvedValue(payload);

    const response = await GET(new Request(`${BASE_URL}?intervals=H1`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("returns 200 with closing prices", async () => {
    const payload: Awaited<ReturnType<typeof getClosingPrices>> = {
      intervals: ["H1"],
      updatedAt: "2024-01-01T00:00:00.000Z",
      data: [{ symbol: "BTCUSDT", prices: { H1: "50000" } }],
    };
    mockedGetClosingPrices.mockResolvedValue(payload);

    const response = await GET(
      new Request(`${BASE_URL}?symbols=BTCUSDT&intervals=H1`),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mockedGetClosingPrices).toHaveBeenCalledWith({
      intervals: ["H1"],
      symbolsFilter: ["BTCUSDT"],
    });
  });
});
