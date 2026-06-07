import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();
const mockListPushSubscriptions = vi.fn();
const mockRemovePushSubscription = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
}));

vi.mock("@/helpers/notifications/subscriptions", () => ({
  listPushSubscriptions: (...args: unknown[]) =>
    mockListPushSubscriptions(...args),
  removePushSubscription: (...args: unknown[]) =>
    mockRemovePushSubscription(...args),
}));

import { sendTradeExecutedPush } from "./web-push";

describe("sendTradeExecutedPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    delete process.env.WEB_PUSH_SUBJECT;
    mockListPushSubscriptions.mockResolvedValue([]);
    mockSendNotification.mockResolvedValue(undefined);
    mockRemovePushSubscription.mockResolvedValue(undefined);
  });

  it("skips when VAPID env vars are missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTradeExecutedPush({
      title: "Trade",
      body: "body",
      data: { tradeId: 1, symbol: "BTCUSDT", side: "BUY", reason: "entry" },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Web push skipped: VAPID env vars not configured",
    );
    expect(mockListPushSubscriptions).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns early when no subscriptions exist", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "pub";
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "priv";
    process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";

    await sendTradeExecutedPush({
      title: "Trade",
      body: "body",
      data: { tradeId: 1, symbol: "BTCUSDT", side: "BUY", reason: "entry" },
    });

    expect(mockSetVapidDetails).toHaveBeenCalledOnce();
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("sends notification to all subscriptions", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "pub";
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "priv";
    process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";
    mockListPushSubscriptions.mockResolvedValue([
      { endpoint: "https://a", p256dh: "p1", auth: "a1" },
      { endpoint: "https://b", p256dh: "p2", auth: "a2" },
    ]);

    await sendTradeExecutedPush({
      title: "Trade executed: BUY BTCUSDT",
      body: "details",
      data: { tradeId: 2, symbol: "BTCUSDT", side: "BUY", reason: "entry" },
    });

    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it("removes stale subscriptions on 410", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "pub";
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "priv";
    process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";
    mockListPushSubscriptions.mockResolvedValue([
      { endpoint: "https://stale", p256dh: "p", auth: "a" },
    ]);
    mockSendNotification.mockRejectedValueOnce({ statusCode: 410 });

    await sendTradeExecutedPush({
      title: "Trade",
      body: "body",
      data: { tradeId: 1, symbol: "BTCUSDT", side: "SELL", reason: "exit" },
    });

    expect(mockRemovePushSubscription).toHaveBeenCalledWith("https://stale");
  });

  it("logs non-stale send failures", async () => {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "pub";
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = "priv";
    process.env.WEB_PUSH_SUBJECT = "mailto:test@example.com";
    mockListPushSubscriptions.mockResolvedValue([
      { endpoint: "https://x", p256dh: "p", auth: "a" },
    ]);
    mockSendNotification.mockRejectedValueOnce(new Error("network"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await sendTradeExecutedPush({
      title: "Trade",
      body: "body",
      data: { tradeId: 1, symbol: "BTCUSDT", side: "BUY", reason: "entry" },
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(mockRemovePushSubscription).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
