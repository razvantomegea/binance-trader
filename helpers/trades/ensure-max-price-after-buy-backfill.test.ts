import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/trades/backfill-max-price-after-buy", () => ({
  backfillMaxPriceAfterBuy: vi.fn(),
}));

import { backfillMaxPriceAfterBuy } from "@/helpers/trades/backfill-max-price-after-buy";
import {
  ensureMaxPriceAfterBuyBackfill,
  resetBackfillPromiseForTests,
} from "./ensure-max-price-after-buy-backfill";

const mockedBackfill = vi.mocked(backfillMaxPriceAfterBuy);

describe("ensureMaxPriceAfterBuyBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBackfillPromiseForTests();
  });

  it("awaits backfill once and resolves", async () => {
    mockedBackfill.mockResolvedValue({ scanned: 1, updated: 1, skipped: 0 });

    await ensureMaxPriceAfterBuyBackfill();

    expect(mockedBackfill).toHaveBeenCalledTimes(1);
  });

  it("reuses in-flight promise for concurrent callers", async () => {
    let resolveBackfill!: (
      value: Awaited<ReturnType<typeof backfillMaxPriceAfterBuy>>,
    ) => void;
    mockedBackfill.mockReturnValue(
      new Promise((resolve) => {
        resolveBackfill = resolve;
      }) as ReturnType<typeof backfillMaxPriceAfterBuy>,
    );

    const first = ensureMaxPriceAfterBuyBackfill();
    const second = ensureMaxPriceAfterBuyBackfill();

    resolveBackfill({ scanned: 0, updated: 0, skipped: 0 });
    await Promise.all([first, second]);

    expect(mockedBackfill).toHaveBeenCalledTimes(1);
  });

  it("allows retry after backfill failure", async () => {
    mockedBackfill
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ scanned: 0, updated: 0, skipped: 0 });

    await ensureMaxPriceAfterBuyBackfill();
    await ensureMaxPriceAfterBuyBackfill();

    expect(mockedBackfill).toHaveBeenCalledTimes(2);
  });
});
