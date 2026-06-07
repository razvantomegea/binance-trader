import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");

import { getDb } from "@/db";

import { getLastSymbolCloseTime } from "./get-last-symbol-close-time";

const mockedGetDb = vi.mocked(getDb);

describe("getLastSymbolCloseTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when symbol has no SELL trades", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getLastSymbolCloseTime("BTCUSDT")).resolves.toBeNull();
  });

  it("returns candle open time in ms for latest SELL", async () => {
    const candleOpenTime = new Date("2024-06-01T12:00:00.000Z");
    const limit = vi.fn().mockResolvedValue([{ candleOpenTime }]);
    const orderBy = vi.fn().mockReturnValue({ limit });
    const where = vi.fn().mockReturnValue({ orderBy });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getLastSymbolCloseTime("BTCUSDT")).resolves.toBe(
      candleOpenTime.getTime(),
    );
  });
});
