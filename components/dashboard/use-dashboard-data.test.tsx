import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_POLL_MS } from "@/constants/dashboard";
import { mockStrategyStatus } from "@/e2e/fixtures/dashboard-api-mocks";
import {
  type DashboardFetchMock,
  installDashboardFetchMock,
} from "@/test/dashboard-api-fetch-mocks";

import { useDashboardData } from "./use-dashboard-data";

async function flushDashboardLoad(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function installInterceptingFetchMock(
  intercept: (url: string) => Response | null,
): DashboardFetchMock {
  const baseMock = installDashboardFetchMock();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const intercepted = intercept(url);
    if (intercepted) {
      return intercepted;
    }
    return baseMock(input);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function installGrantedNotificationMock(): ReturnType<typeof vi.fn> {
  const notificationCtor = vi.fn();
  class MockNotification {
    static permission = "granted";
    constructor(_title: string, _opts: { body: string }) {
      notificationCtor();
    }
  }
  vi.stubGlobal("Notification", MockNotification);
  return notificationCtor;
}

function registerLoadAndSelectionTests(): void {
  it("loads dashboard data on mount via polling refresh", async () => {
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    expect(result.current.loadingSymbols).toBe(false);
    expect(result.current.loadingPortfolio).toBe(false);
    expect(result.current.portfolio).not.toBeNull();
    expect(result.current.symbolRows.length).toBeGreaterThan(0);
    expect(result.current.strategyStatus).toEqual(mockStrategyStatus);
  });

  it("selectUsdtSymbol accepts USDT pairs and ignores invalid symbols", async () => {
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    act(() => {
      result.current.selectUsdtSymbol("ETHUSDT");
    });
    expect(result.current.selectedSymbol).toBe("ETHUSDT");

    act(() => {
      result.current.selectUsdtSymbol("ETHBTC");
    });
    expect(result.current.selectedSymbol).toBe("ETHUSDT");
  });

  it("refresh reloads dashboard data", async () => {
    const fetchMock = installDashboardFetchMock();
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    fetchMock.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(result.current.loadingPortfolio).toBe(false);
  });
}

function registerClosePositionTests(): void {
  it("closePosition cancels when user declines confirm", async () => {
    vi.stubGlobal(
      "confirm",
      vi.fn(() => false),
    );
    const fetchMock = installDashboardFetchMock();
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    fetchMock.mockClear();

    await act(async () => {
      await result.current.closePosition("BTCUSDT");
    });

    const closeCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/positions/close"),
    );
    expect(closeCalls).toHaveLength(0);
  });

  it("closePosition records error on failed response", async () => {
    installInterceptingFetchMock((url) =>
      url.includes("/api/positions/close")
        ? new Response("close failed", { status: 500 })
        : null,
    );

    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    await act(async () => {
      await result.current.closePosition("BTCUSDT");
    });

    expect(result.current.closePositionError).toContain(
      "Could not close BTCUSDT (500)",
    );
    expect(result.current.closingSymbol).toBeNull();
  });

  it("closePosition refreshes on success", async () => {
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    await act(async () => {
      await result.current.closePosition("BTCUSDT");
    });

    expect(result.current.closePositionError).toBeNull();
    expect(result.current.closingSymbol).toBeNull();
  });

  it("uses unknown error fallback when close response body is empty", async () => {
    installInterceptingFetchMock((url) =>
      url.includes("/api/positions/close")
        ? new Response("", { status: 500 })
        : null,
    );

    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    await act(async () => {
      await result.current.closePosition("BTCUSDT");
    });

    expect(result.current.closePositionError).toContain("unknown error");
  });
}

function registerStrategyToggleTests(): void {
  it("toggleStrategy starts strategy when not running", async () => {
    const fetchMock = installDashboardFetchMock();
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    fetchMock.mockClear();

    await act(async () => {
      await result.current.toggleStrategy();
    });

    const startCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/strategy/start"),
    );
    expect(startCalls.length).toBeGreaterThan(0);
    expect(result.current.strategyActionPending).toBe(false);
  });

  it("toggleStrategy stops strategy when running", async () => {
    installDashboardFetchMock({
      strategyStatus: { ...mockStrategyStatus, running: true },
    });
    const fetchMock = vi.mocked(globalThis.fetch);
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    fetchMock.mockClear();

    await act(async () => {
      await result.current.toggleStrategy();
    });

    const stopCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/api/strategy/stop"),
    );
    expect(stopCalls.length).toBeGreaterThan(0);
  });

  it("toggleStrategy records error on failed response", async () => {
    installInterceptingFetchMock((url) =>
      url.includes("/api/strategy/start")
        ? new Response("start failed", { status: 500 })
        : null,
    );

    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    await act(async () => {
      await result.current.toggleStrategy();
    });

    expect(
      result.current.cronAlerts.some((a) => a.id === "strategy-action-error"),
    ).toBe(true);
  });

  it("uses unknown error fallback when strategy toggle response body is empty", async () => {
    installInterceptingFetchMock((url) =>
      url.includes("/api/strategy/start")
        ? new Response("", { status: 500 })
        : null,
    );

    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    await act(async () => {
      await result.current.toggleStrategy();
    });

    expect(
      result.current.cronAlerts.some((alert) =>
        alert.message.includes("unknown error"),
      ),
    ).toBe(true);
  });
}

function registerAlertAndNotificationTests(): void {
  it("builds cron alerts from status request errors", async () => {
    installDashboardFetchMock({ fail: { strategyStatus: 500 } });
    const { result } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    expect(result.current.cronAlerts.length).toBeGreaterThan(0);
    expect(result.current.cronAlerts[0]!.id).toBe("status-request-error");
  });

  it("notifies with warning alerts when no error alert exists", async () => {
    const notificationCtor = installGrantedNotificationMock();

    installDashboardFetchMock({
      strategyStatus: {
        ...mockStrategyStatus,
        running: true,
        startedAt: new Date(Date.now() - 4 * 3_600_000).toISOString(),
        lastRunAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
        nextRunAt: null,
      },
    });

    renderHook(() => useDashboardData());
    await flushDashboardLoad();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(notificationCtor).toHaveBeenCalled();
  });

  it("sends browser notification for cron alerts when permission granted", async () => {
    const notificationCtor = installGrantedNotificationMock();

    installDashboardFetchMock({
      strategyStatus: {
        ...mockStrategyStatus,
        running: true,
        startedAt: new Date(Date.now() - 3_600_000).toISOString(),
        lastRunAt: null,
      },
    });

    renderHook(() => useDashboardData());
    await flushDashboardLoad();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(notificationCtor).toHaveBeenCalled();
  });

  it("skips browser notifications when permission is denied", async () => {
    const notificationCtor = vi.fn();
    class MockNotification {
      static permission = "denied";
      constructor() {
        notificationCtor();
      }
    }
    vi.stubGlobal("Notification", MockNotification);

    installDashboardFetchMock({ fail: { strategyStatus: 500 } });
    renderHook(() => useDashboardData());
    await flushDashboardLoad();

    expect(notificationCtor).not.toHaveBeenCalled();
  });
}

function registerPollingAndDedupeTests(): void {
  it("logs polling refresh errors without crashing", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    installInterceptingFetchMock((url) => {
      if (url.includes("/api/portfolio")) {
        throw new Error("network down");
      }
      return null;
    });

    renderHook(() => useDashboardData());
    await flushDashboardLoad();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Dashboard polling refresh failed:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("skips duplicate browser notifications for same alert", async () => {
    const notificationCtor = installGrantedNotificationMock();

    installDashboardFetchMock({ fail: { strategyStatus: 500 } });

    const { rerender } = renderHook(() => useDashboardData());
    await flushDashboardLoad();

    const callsAfterFirst = notificationCtor.mock.calls.length;
    rerender();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(notificationCtor.mock.calls.length).toBe(callsAfterFirst);
  });
}

function registerPollingTests(): void {
  it("polls on interval", async () => {
    vi.useFakeTimers();
    const fetchMock = installDashboardFetchMock();
    renderHook(() => useDashboardData());

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const callsAfterInit = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterInit);
    vi.useRealTimers();
  });
}

describe("useDashboardData", () => {
  beforeEach(() => {
    installDashboardFetchMock();
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  registerLoadAndSelectionTests();
  registerClosePositionTests();
  registerStrategyToggleTests();
  registerAlertAndNotificationTests();
  registerPollingAndDedupeTests();
  registerPollingTests();
});
