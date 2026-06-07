import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_LOSS_PCT } from "@/constants/binance";

vi.mock("@/db");

import { getDb } from "@/db";

import {
  getExposurePeakEquity,
  isPortfolioDrawdownBreached,
  nextExposurePeakEquity,
  setExposurePeakEquity,
} from "./exposure-peak-equity";

const mockedGetDb = vi.mocked(getDb);

describe("getExposurePeakEquity", () => {
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

    await expect(getExposurePeakEquity("H1")).resolves.toBeNull();
  });

  it("returns null for non-positive parsed values", async () => {
    const limit = vi.fn().mockResolvedValue([{ value: "0" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getExposurePeakEquity("H1")).resolves.toBeNull();
  });

  it("returns parsed peak when positive", async () => {
    const limit = vi.fn().mockResolvedValue([{ value: "12000" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(getExposurePeakEquity("H1")).resolves.toBe(12000);
  });
});

describe("setExposurePeakEquity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes meta when peakEquity is null", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where });
    mockedGetDb.mockReturnValue({ delete: del } as unknown as ReturnType<
      typeof getDb
    >);

    await setExposurePeakEquity({ interval: "H1", peakEquity: null });

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("upserts meta when peakEquity is set", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    mockedGetDb.mockReturnValue({ insert } as unknown as ReturnType<
      typeof getDb
    >);

    await setExposurePeakEquity({ interval: "H1", peakEquity: 15000 });

    expect(values).toHaveBeenCalledWith({
      key: "exposure_peak_equity_H1",
      value: "15000",
    });
  });
});

describe("isPortfolioDrawdownBreached", () => {
  it("returns false when exposure peak is non-positive", () => {
    expect(
      isPortfolioDrawdownBreached({ equity: 1000, exposurePeakEquity: 0 }),
    ).toBe(false);
  });

  it("returns true when equity falls below threshold", () => {
    const peak = 10_000;
    const threshold = MAX_LOSS_PCT;
    const breachedEquity = peak * (1 - threshold) - 1;

    expect(
      isPortfolioDrawdownBreached({
        equity: breachedEquity,
        exposurePeakEquity: peak,
      }),
    ).toBe(true);
  });

  it("returns false when equity is above threshold", () => {
    expect(
      isPortfolioDrawdownBreached({
        equity: 9000,
        exposurePeakEquity: 10_000,
        thresholdPct: 0.15,
      }),
    ).toBe(false);
  });
});

describe("nextExposurePeakEquity", () => {
  it("returns null when no open positions", () => {
    expect(
      nextExposurePeakEquity({
        currentPeak: 10_000,
        equity: 11_000,
        hasOpenPositions: false,
      }),
    ).toBeNull();
  });

  it("seeds peak from equity when current peak is null", () => {
    expect(
      nextExposurePeakEquity({
        currentPeak: null,
        equity: 10_500,
        hasOpenPositions: true,
      }),
    ).toBe(10_500);
  });

  it("tracks max of current peak and equity", () => {
    expect(
      nextExposurePeakEquity({
        currentPeak: 10_000,
        equity: 10_500,
        hasOpenPositions: true,
      }),
    ).toBe(10_500);
    expect(
      nextExposurePeakEquity({
        currentPeak: 11_000,
        equity: 10_500,
        hasOpenPositions: true,
      }),
    ).toBe(11_000);
  });
});
