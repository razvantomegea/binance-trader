import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/strategy/close-open-position", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    closeOpenPosition: vi.fn(),
  };
});

import {
  closeOpenPosition,
  PositionNotFoundError,
} from "@/helpers/strategy/close-open-position";

import { POST } from "./route";

const mockedCloseOpenPosition = vi.mocked(closeOpenPosition);

const BASE_URL = "http://test.local/api/positions/close";

function postJson(body: unknown): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/positions/close", () => {
  beforeEach(() => {
    mockedCloseOpenPosition.mockReset();
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await POST(
      new Request(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("returns 400 when symbol is missing", async () => {
    const response = await POST(postJson({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "symbol is required",
    });
  });

  it("returns 400 for non-USDT symbol", async () => {
    const response = await POST(postJson({ symbol: "BTCETH" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only symbols ending with USDT are allowed",
    });
  });

  it("returns 404 when position is not found", async () => {
    mockedCloseOpenPosition.mockRejectedValue(
      new PositionNotFoundError("BTCUSDT"),
    );

    const response = await POST(postJson({ symbol: "BTCUSDT" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No open position for BTCUSDT",
    });
  });

  it("returns fallback error when close fails with non-Error", async () => {
    mockedCloseOpenPosition.mockRejectedValue("trade failed");

    const response = await POST(postJson({ symbol: "BTCUSDT" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to close position",
    });
  });

  it("returns 500 when close fails", async () => {
    mockedCloseOpenPosition.mockRejectedValue(new Error("trade failed"));

    const response = await POST(postJson({ symbol: "BTCUSDT" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "trade failed",
    });
  });

  it("returns 200 when position closes successfully", async () => {
    mockedCloseOpenPosition.mockResolvedValue(undefined);

    const response = await POST(postJson({ symbol: "btcusdt" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedCloseOpenPosition).toHaveBeenCalledWith({ symbol: "BTCUSDT" });
  });
});
