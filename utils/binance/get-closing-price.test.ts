import { beforeEach, describe, expect, it, vi } from "vitest";

import { getClosingPrice } from "./get-closing-price";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

describe("getClosingPrice", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns close price from first kline", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([[1000, "1", "2", "0.5", "1.5", "10"]]), {
        status: 200,
      }),
    );

    await expect(
      getClosingPrice({ symbol: "BTCUSDT", interval: "H1" }),
    ).resolves.toBe("1.5");
  });

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));

    await expect(
      getClosingPrice({ symbol: "BTCUSDT", interval: "H1" }),
    ).resolves.toBeNull();
  });

  it("returns null when klines array is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await expect(
      getClosingPrice({ symbol: "BTCUSDT", interval: "H1" }),
    ).resolves.toBeNull();
  });
});
