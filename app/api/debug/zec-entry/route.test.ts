import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_LOOKBACK_CLOSES } from "@/constants/strategy";
import type { KlineCandle } from "@/types/binance";

vi.mock("@/db");
vi.mock("@/utils/binance/get-klines");

import { getDb } from "@/db";
import {
  getHistoricalClosedKlines,
  getRecentClosedKlines,
} from "@/utils/binance/get-klines";

import { GET } from "./route";

const mockedGetDb = vi.mocked(getDb);
const mockedGetHistoricalClosedKlines = vi.mocked(getHistoricalClosedKlines);
const mockedGetRecentClosedKlines = vi.mocked(getRecentClosedKlines);

const HOUR_MS = 3_600_000;

function makeCandles(count: number, startOpenTime = 1_000_000): KlineCandle[] {
  return Array.from({ length: count }, (_, index) => ({
    openTime: startOpenTime + index * HOUR_MS,
    open: 100 + index,
    high: 110 + index,
    low: 90 + index,
    close: 105 + index,
  }));
}

function mockDbQueries({
  positionRows = [],
  tradeRows = [],
}: {
  positionRows?: unknown[];
  tradeRows?: unknown[];
} = {}): void {
  const positionWhere = vi.fn().mockResolvedValue(positionRows);
  const positionFrom = vi.fn().mockReturnValue({ where: positionWhere });
  const tradeWhere = vi.fn().mockResolvedValue(tradeRows);
  const tradeFrom = vi.fn().mockReturnValue({ where: tradeWhere });
  const select = vi
    .fn()
    .mockReturnValueOnce({ from: positionFrom })
    .mockReturnValueOnce({ from: tradeFrom });

  mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
    typeof getDb
  >);
}

describe("GET /api/debug/zec-entry", () => {
  beforeEach(() => {
    mockedGetDb.mockReset();
    mockedGetHistoricalClosedKlines.mockReset();
    mockedGetRecentClosedKlines.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("returns 200 with debug payload", async () => {
    const buyOpenTime = 28 * HOUR_MS;
    mockDbQueries({
      positionRows: [
        {
          buyPrice: "100",
          qty: "1",
          maxPriceAfterBuy: "110",
          buyTime: new Date(buyOpenTime),
        },
      ],
      tradeRows: [
        {
          price: "100",
          reason: "entry",
          candleOpenTime: new Date(buyOpenTime),
        },
      ],
    });

    mockedGetHistoricalClosedKlines.mockResolvedValue(makeCandles(33, 0));
    mockedGetRecentClosedKlines.mockResolvedValue(
      makeCandles(STRATEGY_LOOKBACK_CLOSES, buyOpenTime),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dbPosition).toMatchObject({
      buyPrice: "100",
      qty: "1",
      maxPriceAfterBuy: "110",
    });
    expect(body.buyTrade).toMatchObject({
      price: "100",
      reason: "entry",
    });
    expect(body.atBuy).toMatchObject({ label: "at_buy" });
    expect(body.live).toMatchObject({ label: "live_now" });
  });

  it("returns 200 with null diagnoses when data is insufficient", async () => {
    mockDbQueries();
    mockedGetRecentClosedKlines.mockResolvedValue(makeCandles(5));

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.dbPosition).toBeNull();
    expect(body.buyTrade).toBeNull();
    expect(body.atBuy).toBeNull();
    expect(body.live).toBeNull();
  });
});
