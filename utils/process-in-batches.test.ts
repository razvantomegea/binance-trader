import { describe, expect, it } from "vitest";

import { processInBatches } from "./process-in-batches";

describe("processInBatches", () => {
  it("returns empty array for no items", async () => {
    const result = await processInBatches({
      items: [],
      batchSize: 2,
      processItem: async (item) => item,
    });

    expect(result).toEqual([]);
  });

  it("processes all items and preserves order", async () => {
    const result = await processInBatches({
      items: [1, 2, 3, 4, 5],
      batchSize: 2,
      processItem: async (n) => n * 2,
    });
    expect(result).toEqual([2, 4, 6, 8, 10]);
  });

  it("propagates errors from processItem", async () => {
    await expect(
      processInBatches({
        items: [1, 2],
        batchSize: 2,
        processItem: async (n) => {
          if (n === 2) {
            throw new Error("fail");
          }
          return n;
        },
      }),
    ).rejects.toThrow("fail");
  });
});
