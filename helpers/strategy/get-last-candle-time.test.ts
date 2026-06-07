import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");

import { getDb } from "@/db";

import { getLastCandleTime, setLastCandleTime } from "./get-last-candle-time";

const mockedGetDb = vi.mocked(getDb);

describe("getLastCandleTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when meta row is missing", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getLastCandleTime("H1")).resolves.toBeNull();
  });

  it("returns parsed open time when value is finite", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue([{ key: "last_candle_H1", value: "3600000" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getLastCandleTime("H1")).resolves.toBe(3600000);
  });

  it("returns null when stored value is not finite", async () => {
    const limit = vi
      .fn()
      .mockResolvedValue([{ key: "last_candle_H1", value: "bad" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getLastCandleTime("H1")).resolves.toBeNull();
  });
});

describe("setLastCandleTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts meta key for interval", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    mockedGetDb.mockReturnValue({ insert } as unknown as ReturnType<
      typeof getDb
    >);

    await setLastCandleTime({ interval: "H1", openTime: 7200000 });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith({
      key: "last_candle_H1",
      value: "7200000",
    });
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });
});
