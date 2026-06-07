import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendTradeExecutedPush = vi.fn();

vi.mock("@/helpers/notifications/web-push", () => ({
  sendTradeExecutedPush: (...args: unknown[]) =>
    mockSendTradeExecutedPush(...args),
}));

import { notifyTradeExecuted } from "./notify-trade-executed";

describe("notifyTradeExecuted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendTradeExecutedPush.mockResolvedValue(undefined);
  });

  it("fires push with formatted payload", async () => {
    notifyTradeExecuted({
      tradeId: 42,
      symbol: "BTCUSDT",
      side: "BUY",
      qty: 1.5,
      price: 100,
      reason: "entry_band",
      interval: "H1",
    });

    await vi.waitFor(() => {
      expect(mockSendTradeExecutedPush).toHaveBeenCalledOnce();
    });

    expect(mockSendTradeExecutedPush).toHaveBeenCalledWith({
      title: "Trade executed: BUY BTCUSDT",
      body: "BUY 1.5 @ 100 · entry_band (H1)",
      data: {
        tradeId: 42,
        symbol: "BTCUSDT",
        side: "BUY",
        reason: "entry_band",
      },
    });
  });

  it("logs when push send rejects", async () => {
    mockSendTradeExecutedPush.mockRejectedValueOnce(new Error("push failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    notifyTradeExecuted({
      tradeId: 1,
      symbol: "ETHUSDT",
      side: "SELL",
      qty: 2,
      price: 50,
      reason: "trailing_stop",
      interval: "H1",
    });

    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "notifyTradeExecuted failed",
        expect.any(Error),
      );
    });

    errorSpy.mockRestore();
  });
});
