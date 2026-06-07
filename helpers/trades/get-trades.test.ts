import { beforeEach, describe, expect, it, vi } from "vitest";

import { NULL_TRADE_POST_CLOSE_24H } from "@/types/trade-metrics";

vi.mock("@/db");
vi.mock("@/db/with-db-retry", () => ({
  withDbRetry: (op: () => Promise<unknown>) => op(),
}));

import { getDb } from "@/db";

import { getTrades } from "./get-trades";

const mockedGetDb = vi.mocked(getDb);

const CREATED_AT = new Date("2024-06-01T12:00:00.000Z");
const CANDLE_TIME = new Date("2024-06-01T11:00:00.000Z");

function mockGetTradesQueries(params: {
  tradeRows: Array<Record<string, unknown>>;
  total: number;
  buyRows?: Array<Record<string, unknown>>;
}) {
  const _tradeFrom = vi.fn().mockResolvedValue(params.tradeRows);
  const tradeLimit = vi
    .fn()
    .mockReturnValue({ offset: vi.fn().mockReturnValue({ then: undefined }) });
  const tradeOffset = vi.fn().mockResolvedValue(params.tradeRows);
  tradeLimit.mockReturnValue({ offset: tradeOffset });
  const tradeOrderBy = vi.fn().mockReturnValue({ limit: tradeLimit });
  const tradeSelectFrom = vi.fn().mockReturnValue({ orderBy: tradeOrderBy });

  const countFrom = vi.fn().mockResolvedValue([{ total: params.total }]);
  const _countSelect = vi.fn().mockReturnValue({ from: countFrom });

  const _buyFrom = vi.fn().mockResolvedValue(params.buyRows ?? []);
  const buyOrderBy = vi.fn().mockResolvedValue(params.buyRows ?? []);
  const buyWhere = vi.fn().mockReturnValue({ orderBy: buyOrderBy });
  const buySelectFrom = vi.fn().mockReturnValue({ where: buyWhere });

  let selectCall = 0;
  const select = vi.fn().mockImplementation(() => {
    selectCall += 1;
    if (selectCall === 1) {
      return { from: tradeSelectFrom };
    }
    if (selectCall === 2) {
      return { from: countFrom };
    }
    return { from: buySelectFrom };
  });

  mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
    typeof getDb
  >);
}

describe("getTrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps BUY rows with openPrice and null realized pnl", async () => {
    mockGetTradesQueries({
      total: 1,
      tradeRows: [
        {
          id: 1,
          symbol: "BTCUSDT",
          side: "BUY",
          qty: "1",
          price: "100",
          maxPriceAfterBuy: null,
          maxPriceAfterClose24h: null,
          minPriceAfterClose24h: null,
          maxPriceAfterClose24hPct: null,
          minPriceAfterClose24hPct: null,
          notional: "100",
          interval: "H1",
          candleOpenTime: CANDLE_TIME,
          reason: "entry",
          createdAt: CREATED_AT,
        },
      ],
    });

    const result = await getTrades({ limit: 10, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.trades[0]).toMatchObject({
      id: 1,
      side: "BUY",
      openPrice: "100",
      closePrice: null,
      realizedPnlPct: null,
      maxPriceAfterClose24h: NULL_TRADE_POST_CLOSE_24H.maxPriceAfterClose24h,
    });
  });

  it("computes realized pnl for SELL using prior BUY", async () => {
    mockGetTradesQueries({
      total: 1,
      tradeRows: [
        {
          id: 2,
          symbol: "ETHUSDT",
          side: "SELL",
          qty: "2",
          price: "110",
          maxPriceAfterBuy: "115",
          maxPriceAfterClose24h: "112",
          minPriceAfterClose24h: "108",
          maxPriceAfterClose24hPct: "1.82",
          minPriceAfterClose24hPct: "-1.82",
          notional: "220",
          interval: "H1",
          candleOpenTime: CANDLE_TIME,
          reason: "trailing_stop",
          createdAt: new Date("2024-06-02T12:00:00.000Z"),
        },
      ],
      buyRows: [
        {
          symbol: "ETHUSDT",
          price: "100",
          createdAt: new Date("2024-06-01T10:00:00.000Z"),
        },
      ],
    });

    const result = await getTrades({ limit: 10, offset: 0 });
    const sell = result.trades[0]!;

    expect(sell.openPrice).toBe("100");
    expect(sell.closePrice).toBe("110");
    expect(sell.realizedPnlPct).toBe(10);
    expect(sell.maxPriceAfterClose24h).toBe(112);
  });

  it("returns null openPrice for SELL without matching BUY", async () => {
    mockGetTradesQueries({
      total: 1,
      tradeRows: [
        {
          id: 3,
          symbol: "SOLUSDT",
          side: "SELL",
          qty: "1",
          price: "50",
          maxPriceAfterBuy: null,
          maxPriceAfterClose24h: null,
          minPriceAfterClose24h: null,
          maxPriceAfterClose24hPct: null,
          minPriceAfterClose24hPct: null,
          notional: "50",
          interval: "H1",
          candleOpenTime: CANDLE_TIME,
          reason: "manual_close",
          createdAt: CREATED_AT,
        },
      ],
      buyRows: [],
    });

    const result = await getTrades({ limit: 10, offset: 0 });
    expect(result.trades[0]?.openPrice).toBeNull();
    expect(result.trades[0]?.realizedPnlPct).toBeNull();
  });
});
