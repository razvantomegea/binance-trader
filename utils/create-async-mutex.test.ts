import { describe, expect, it, vi } from "vitest";

import { createAsyncMutex } from "./create-async-mutex";

describe("createAsyncMutex", () => {
  it("serializes async work through the mutex", async () => {
    const mutex = createAsyncMutex();
    const order: number[] = [];

    await Promise.all([
      mutex.run(async () => {
        order.push(1);
        await Promise.resolve();
        order.push(2);
      }),
      mutex.run(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("continues the chain after a rejected task", async () => {
    const mutex = createAsyncMutex();
    const afterFailure = vi.fn();

    await expect(
      mutex.run(async () => {
        throw new Error("mutex failure");
      }),
    ).rejects.toThrow("mutex failure");

    await mutex.run(async () => {
      afterFailure();
    });

    expect(afterFailure).toHaveBeenCalledTimes(1);
  });
});
