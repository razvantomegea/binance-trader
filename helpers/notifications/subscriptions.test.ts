import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");

import { getDb } from "@/db";

import {
  listPushSubscriptions,
  removePushSubscription,
  upsertPushSubscription,
} from "./subscriptions";

const mockedGetDb = vi.mocked(getDb);

describe("subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts push subscription", async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    const insert = vi.fn().mockReturnValue({ values });
    mockedGetDb.mockReturnValue({ insert } as unknown as ReturnType<
      typeof getDb
    >);

    await upsertPushSubscription({
      endpoint: "https://push.example/sub/1",
      keys: { p256dh: "p256", auth: "auth" },
    });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://push.example/sub/1",
        p256dh: "p256",
        auth: "auth",
      }),
    );
    expect(onConflictDoUpdate).toHaveBeenCalled();
  });

  it("removes push subscription by endpoint", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn().mockReturnValue({ where });
    mockedGetDb.mockReturnValue({ delete: del } as unknown as ReturnType<
      typeof getDb
    >);

    await removePushSubscription("https://push.example/sub/1");

    expect(del).toHaveBeenCalled();
    expect(where).toHaveBeenCalled();
  });

  it("lists push subscriptions", async () => {
    const from = vi
      .fn()
      .mockResolvedValue([{ endpoint: "https://a", p256dh: "p1", auth: "a1" }]);
    const select = vi.fn().mockReturnValue({ from });
    mockedGetDb.mockReturnValue({ select } as unknown as ReturnType<
      typeof getDb
    >);

    await expect(listPushSubscriptions()).resolves.toEqual([
      { endpoint: "https://a", p256dh: "p1", auth: "a1" },
    ]);
  });
});
