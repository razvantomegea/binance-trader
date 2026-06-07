import { beforeEach, describe, expect, it, vi } from "vitest";

function makeValidVapidPublicKey(): string {
  const bytes = new Uint8Array(65);
  bytes[0] = 4;
  for (let i = 1; i < 65; i += 1) {
    bytes[i] = i % 256;
  }
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const VALID_VAPID_PUBLIC_KEY = makeValidVapidPublicKey();

const mockFetch = vi.fn();
const mockGetSubscription = vi.fn();
const mockSubscribe = vi.fn();
const mockUnsubscribe = vi.fn();
const mockRegister = vi.fn();
const mockRequestPermission = vi.fn();

function makeSubscription(
  overrides: {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  } = {},
) {
  return {
    endpoint: overrides.endpoint ?? "https://push.example/sub/1",
    toJSON: () => ({
      endpoint: overrides.endpoint ?? "https://push.example/sub/1",
      keys: {
        p256dh: overrides.p256dh ?? "p256dh-key",
        auth: overrides.auth ?? "auth-key",
      },
    }),
    unsubscribe: mockUnsubscribe,
  };
}

function stubPushEnvironment(params: {
  permission?: NotificationPermission;
  subscription?: ReturnType<typeof makeSubscription> | null;
  registerError?: Error;
}) {
  const readyRegistration = {
    pushManager: {
      getSubscription: mockGetSubscription,
      subscribe: mockSubscribe,
    },
  };

  if (params.registerError) {
    mockRegister.mockRejectedValue(params.registerError);
  } else {
    mockRegister.mockResolvedValue(readyRegistration);
  }

  mockGetSubscription.mockResolvedValue(params.subscription ?? null);
  mockSubscribe.mockResolvedValue(params.subscription ?? makeSubscription());
  mockRequestPermission.mockResolvedValue(params.permission ?? "granted");

  class PushManager {}

  const notificationApi = {
    requestPermission: mockRequestPermission,
    permission: params.permission ?? "granted",
  };

  vi.stubGlobal("window", {
    PushManager,
    Notification: notificationApi,
  });
  vi.stubGlobal("Notification", notificationApi);
  vi.stubGlobal("navigator", {
    serviceWorker: {
      register: mockRegister,
      ready: Promise.resolve(readyRegistration),
    },
  });
}

vi.stubGlobal("fetch", mockFetch);

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
} from "./push-client";

function setupPushClientSuite(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe.mockResolvedValue(true);
    stubPushEnvironment({});
  });
}

describe("push-client getPushStatus", () => {
  setupPushClientSuite();

  it("returns unsupported when APIs are missing", async () => {
    vi.stubGlobal("window", {});

    await expect(getPushStatus()).resolves.toEqual({
      state: "unsupported",
      message: null,
    });
  });

  it("returns enabled when subscription exists", async () => {
    stubPushEnvironment({ subscription: makeSubscription() });

    await expect(getPushStatus()).resolves.toEqual({
      state: "enabled",
      message: null,
    });
  });

  it("returns disabled when no subscription", async () => {
    await expect(getPushStatus()).resolves.toEqual({
      state: "disabled",
      message: null,
    });
  });

  it("returns error when service worker registration fails", async () => {
    stubPushEnvironment({ registerError: new Error("sw failed") });

    await expect(getPushStatus()).resolves.toEqual({
      state: "error",
      message: "Could not register service worker",
    });
  });
});

describe("push-client enablePushNotifications", () => {
  setupPushClientSuite();

  it("enables push end-to-end", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ publicKey: VALID_VAPID_PUBLIC_KEY }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "enabled",
      message: null,
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/push/vapid-public-key");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("returns disabled when permission denied", async () => {
    stubPushEnvironment({ permission: "denied" });

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "disabled",
      message: "Notification permission denied",
    });
  });

  it("returns error when vapid endpoint fails", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "not configured" }), {
        status: 503,
      }),
    );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to enable push notifications",
    });
  });

  it("returns error when save subscription fails", async () => {
    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ publicKey: VALID_VAPID_PUBLIC_KEY }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "db down" }), { status: 500 }),
      );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to enable push notifications",
    });
  });

  it("strips quoted vapid keys and reuses existing subscription", async () => {
    const existing = makeSubscription();
    stubPushEnvironment({ subscription: existing });
    mockFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ publicKey: `"${VALID_VAPID_PUBLIC_KEY}"` }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "enabled",
      message: null,
    });

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("returns push-service-specific error message", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ publicKey: VALID_VAPID_PUBLIC_KEY }), {
        status: 200,
      }),
    );
    mockSubscribe.mockRejectedValueOnce(
      new Error("Push service error: blocked"),
    );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message:
        "Browser push service blocked/unavailable. Disable blocking extensions/shields and retry.",
    });
  });
});

describe("push-client enablePushNotifications edge cases", () => {
  setupPushClientSuite();

  it("returns error for invalid vapid key length", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ publicKey: "YQ" }), { status: 200 }),
    );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to enable push notifications",
    });
  });

  it("returns error when subscription payload is incomplete", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ publicKey: VALID_VAPID_PUBLIC_KEY }), {
        status: 200,
      }),
    );
    mockSubscribe.mockResolvedValueOnce(
      makeSubscription({ endpoint: "", p256dh: "", auth: "" }),
    );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to enable push notifications",
    });
  });

  it("includes vapid error details when key endpoint fails", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "missing key", details: "set VAPID keys" }),
        { status: 503 },
      ),
    );

    await expect(enablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to enable push notifications",
    });
  });
});

describe("push-client disablePushNotifications", () => {
  setupPushClientSuite();

  it("returns disabled when no subscription", async () => {
    await expect(disablePushNotifications()).resolves.toEqual({
      state: "disabled",
      message: null,
    });
  });

  it("unsubscribes locally and on server", async () => {
    stubPushEnvironment({ subscription: makeSubscription() });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(disablePushNotifications()).resolves.toEqual({
      state: "disabled",
      message: null,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/push/unsubscribe",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockUnsubscribe).toHaveBeenCalledOnce();
  });

  it("returns error when server unsubscribe fails", async () => {
    stubPushEnvironment({ subscription: makeSubscription() });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 500 }));

    await expect(disablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to disable push notifications",
    });
  });

  it("includes server error details when unsubscribe fails", async () => {
    stubPushEnvironment({ subscription: makeSubscription() });
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "db error", details: "connection reset" }),
        { status: 500 },
      ),
    );

    await expect(disablePushNotifications()).resolves.toEqual({
      state: "error",
      message: "Failed to disable push notifications",
    });
  });
});

describe("push-client platform support", () => {
  setupPushClientSuite();

  it("returns unsupported when PushManager is missing", async () => {
    vi.stubGlobal("window", { Notification: { permission: "granted" } });
    vi.stubGlobal("navigator", { serviceWorker: { register: mockRegister } });

    await expect(getPushStatus()).resolves.toEqual({
      state: "unsupported",
      message: null,
    });
  });
});
