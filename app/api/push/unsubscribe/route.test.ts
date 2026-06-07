import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/notifications/subscriptions");

import { removePushSubscription } from "@/helpers/notifications/subscriptions";

import { POST } from "./route";

const mockedRemovePushSubscription = vi.mocked(removePushSubscription);

const BASE_URL = "http://test.local/api/push/unsubscribe";

function postJson(body: unknown): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/push/unsubscribe", () => {
  beforeEach(() => {
    mockedRemovePushSubscription.mockReset();
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

  it("returns 400 for invalid unsubscribe payload", async () => {
    const response = await POST(postJson({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid unsubscribe payload",
    });
  });

  it("returns 500 when remove fails", async () => {
    mockedRemovePushSubscription.mockRejectedValue(new Error("db error"));

    const response = await POST(
      postJson({ endpoint: "https://push.example/sub/1" }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to remove subscription",
    });
  });

  it("returns 200 when subscription is removed", async () => {
    mockedRemovePushSubscription.mockResolvedValue(undefined);

    const response = await POST(
      postJson({ endpoint: "https://push.example/sub/1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedRemovePushSubscription).toHaveBeenCalledWith(
      "https://push.example/sub/1",
    );
  });
});
