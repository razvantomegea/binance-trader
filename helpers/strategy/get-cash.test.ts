import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");
vi.mock("@/db/with-db-retry", () => ({
  withDbRetry: (op: () => Promise<unknown>) => op(),
}));

import { getDb } from "@/db";
import { INITIAL_PAPER_CASH } from "@/constants/binance";

import { getCash } from "./get-cash";

const mockedGetDb = vi.mocked(getDb);

function mockTradeTotals(buyTotal: string, sellTotal: string) {
  const from = vi.fn().mockResolvedValue([{ buyTotal, sellTotal }]);
  const select = vi.fn().mockReturnValue({ from });
  mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
    typeof getDb
  >);
  return { select, from };
}

describe("getCash", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial cash when no trades exist", async () => {
    mockTradeTotals("0", "0");

    await expect(getCash()).resolves.toBe(INITIAL_PAPER_CASH);
  });

  it("subtracts buy notional and adds sell notional", async () => {
    mockTradeTotals("3000", "1500");

    await expect(getCash()).resolves.toBe(INITIAL_PAPER_CASH + 1500 - 3000);
  });

  it("treats missing row as zero totals", async () => {
    const from = vi.fn().mockResolvedValue([]);
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getCash()).resolves.toBe(INITIAL_PAPER_CASH);
  });
});
