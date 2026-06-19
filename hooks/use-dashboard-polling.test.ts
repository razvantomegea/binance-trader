import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DASHBOARD_POLL_MS } from "@/constants/dashboard";

import { useDashboardPolling } from "./use-dashboard-polling";

describe("useDashboardPolling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls on interval while tab is visible", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });

    renderHook(() => useDashboardPolling(refresh));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const callsAfterInit = refresh.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS);
    });

    expect(refresh.mock.calls.length).toBeGreaterThan(callsAfterInit);
  });

  it("stops polling while tab is hidden", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });

    renderHook(() => useDashboardPolling(refresh));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    const callsAfterInit = refresh.mock.calls.length;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS);
    });

    expect(refresh.mock.calls.length).toBe(callsAfterInit);
  });
});
