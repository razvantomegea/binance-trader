import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/trades/ensure-max-price-after-buy-backfill");
vi.mock("@/helpers/trades/get-trades");

import { ensureMaxPriceAfterBuyBackfill } from "@/helpers/trades/ensure-max-price-after-buy-backfill";
import { getTrades } from "@/helpers/trades/get-trades";

import { GET } from "./route";

const mockedBackfill = vi.mocked(ensureMaxPriceAfterBuyBackfill);
const mockedGetTrades = vi.mocked(getTrades);

const BASE_URL = "http://test.local/api/trades";

describe("GET /api/trades", () => {
  beforeEach(() => {
    mockedBackfill.mockReset();
    mockedGetTrades.mockReset();
    mockedBackfill.mockResolvedValue(undefined);
  });

  it("returns 503 on retryable db error", async () => {
    mockedGetTrades.mockRejectedValue(
      new Error("Control plane request failed"),
    );

    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load trades",
    });
  });

  it("returns 500 on non-retryable error", async () => {
    mockedGetTrades.mockRejectedValue(new Error("unexpected failure"));

    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load trades",
    });
  });

  it("returns 200 with trades payload", async () => {
    const payload = {
      trades: [{ id: 1, symbol: "BTCUSDT" }],
      total: 1,
    };
    mockedGetTrades.mockResolvedValue(
      payload as Awaited<ReturnType<typeof getTrades>>,
    );

    const response = await GET(new Request(`${BASE_URL}?limit=10&offset=0`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
    expect(mockedBackfill).toHaveBeenCalledOnce();
    expect(mockedGetTrades).toHaveBeenCalledWith({ limit: 10, offset: 0 });
  });
});
