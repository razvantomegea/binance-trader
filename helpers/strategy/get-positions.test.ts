import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");
vi.mock("@/db/with-db-retry", () => ({
  withDbRetry: (op: () => Promise<unknown>) => op(),
}));

import { getDb } from "@/db";

import { getOpenPositions } from "./get-positions";

const mockedGetDb = vi.mocked(getDb);

const BUY_TIME = new Date("2024-01-01T00:00:00.000Z");

function mockPositionRows(
  rows: Array<{
    symbol: string;
    qty: string;
    buyPrice: string;
    maxPriceAfterBuy: string | null;
    buyTime: Date;
    buyTradeId: number;
  }>,
) {
  const from = vi.fn().mockResolvedValue(rows);
  const select = vi.fn().mockReturnValue({ from });
  mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
    typeof getDb
  >);
}

describe("getOpenPositions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty map when no positions", async () => {
    mockPositionRows([]);

    const result = await getOpenPositions();
    expect(result.size).toBe(0);
  });

  it("maps rows to OpenPosition with parsed numbers", async () => {
    mockPositionRows([
      {
        symbol: "BTCUSDT",
        qty: "0.5",
        buyPrice: "40000",
        maxPriceAfterBuy: "42000",
        buyTime: BUY_TIME,
        buyTradeId: 7,
      },
    ]);

    const result = await getOpenPositions();
    expect(result.get("BTCUSDT")).toEqual({
      symbol: "BTCUSDT",
      qty: 0.5,
      buyPrice: 40000,
      maxPriceAfterBuy: 42000,
      buyTime: BUY_TIME,
      buyTradeId: 7,
    });
  });

  it("sets maxPriceAfterBuy to null when db value is null", async () => {
    mockPositionRows([
      {
        symbol: "ETHUSDT",
        qty: "1",
        buyPrice: "2000",
        maxPriceAfterBuy: null,
        buyTime: BUY_TIME,
        buyTradeId: 2,
      },
    ]);

    const result = await getOpenPositions();
    expect(result.get("ETHUSDT")?.maxPriceAfterBuy).toBeNull();
  });
});
