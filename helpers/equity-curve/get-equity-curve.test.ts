import { beforeEach, describe, expect, it, vi } from "vitest";

import { STRATEGY_INTERVAL } from "@/constants/strategy";

vi.mock("@/db");
vi.mock("@/db/with-db-retry", () => ({
  withDbRetry: (op: () => Promise<unknown>) => op(),
}));

import { getDb } from "@/db";

import { getEquityCurve } from "./get-equity-curve";

const mockedGetDb = vi.mocked(getDb);

describe("getEquityCurve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns snapshots in ascending time order", async () => {
    const older = {
      id: 1,
      ts: new Date("2024-01-01T00:00:00.000Z"),
      cash: "9000",
      equity: "9500",
      interval: STRATEGY_INTERVAL,
    };
    const newer = {
      id: 2,
      ts: new Date("2024-01-02T00:00:00.000Z"),
      cash: "8500",
      equity: "9800",
      interval: STRATEGY_INTERVAL,
    };

    const limit = vi.fn().mockResolvedValue([newer, older]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    const result = await getEquityCurve({ limit: 10 });

    expect(result.snapshots).toEqual([
      {
        id: 1,
        ts: older.ts.toISOString(),
        cash: 9000,
        equity: 9500,
        interval: STRATEGY_INTERVAL,
      },
      {
        id: 2,
        ts: newer.ts.toISOString(),
        cash: 8500,
        equity: 9800,
        interval: STRATEGY_INTERVAL,
      },
    ]);
  });

  it("returns empty snapshots when no rows exist", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    const result = await getEquityCurve({ limit: 5 });
    expect(result.snapshots).toEqual([]);
  });
});
