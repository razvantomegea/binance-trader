import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/notifications/subscriptions");

import { upsertPushSubscription } from "@/helpers/notifications/subscriptions";

import { POST } from "./route";

const mockedUpsertPushSubscription = vi.mocked(upsertPushSubscription);

const BASE_URL = "http://test.local/api/push/subscribe";

const validSubscription = {
  endpoint: "https://push.example/sub/1",
  keys: { p256dh: "key", auth: "auth" },
};

function postJson(body: unknown): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/push/subscribe", () => {
  beforeEach(() => {
    mockedUpsertPushSubscription.mockReset();
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

  it("returns 400 for invalid subscription payload", async () => {
    const response = await POST(postJson({ endpoint: "https://push.example" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid subscription payload",
    });
  });

  it("returns 500 when save fails", async () => {
    mockedUpsertPushSubscription.mockRejectedValue(new Error("db error"));

    const response = await POST(postJson(validSubscription));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to save subscription",
    });
  });

  it("returns 200 when subscription is saved", async () => {
    mockedUpsertPushSubscription.mockResolvedValue(undefined);

    const response = await POST(postJson(validSubscription));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockedUpsertPushSubscription).toHaveBeenCalledWith(
      validSubscription,
    );
  });
});
