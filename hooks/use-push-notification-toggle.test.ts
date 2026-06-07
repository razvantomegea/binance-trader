import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
} from "@/utils/notifications/push-client";

import { usePushNotificationToggle } from "./use-push-notification-toggle";

vi.mock("@/utils/notifications/push-client", () => ({
  getPushStatus: vi.fn(),
  enablePushNotifications: vi.fn(),
  disablePushNotifications: vi.fn(),
}));

const mockedGetPushStatus = vi.mocked(getPushStatus);
const mockedEnablePush = vi.mocked(enablePushNotifications);
const mockedDisablePush = vi.mocked(disablePushNotifications);

function setupPushToggleSuite(): void {
  afterEach(() => {
    vi.clearAllMocks();
  });
}

describe("usePushNotificationToggle core flows", () => {
  setupPushToggleSuite();

  it("loads initial push status on mount", async () => {
    mockedGetPushStatus.mockResolvedValue({
      state: "disabled",
      message: null,
    });

    const { result } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("disabled");
    });
    expect(result.current.isEnabled).toBe(false);
    expect(mockedGetPushStatus).toHaveBeenCalledTimes(1);
  });

  it("enables push notifications and updates state", async () => {
    mockedGetPushStatus.mockResolvedValue({
      state: "disabled",
      message: null,
    });
    mockedEnablePush.mockResolvedValue({
      state: "enabled",
      message: null,
    });

    const { result } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("disabled");
    });

    await act(async () => {
      await result.current.enablePush();
    });

    expect(mockedEnablePush).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("enabled");
    expect(result.current.isEnabled).toBe(true);
  });

  it("disables push notifications and updates state", async () => {
    mockedGetPushStatus.mockResolvedValue({
      state: "enabled",
      message: null,
    });
    mockedDisablePush.mockResolvedValue({
      state: "disabled",
      message: null,
    });

    const { result } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("enabled");
    });

    await act(async () => {
      await result.current.disablePush();
    });

    expect(mockedDisablePush).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("disabled");
    expect(result.current.isEnabled).toBe(false);
  });

  it("surfaces action error messages", async () => {
    mockedGetPushStatus.mockResolvedValue({
      state: "disabled",
      message: null,
    });
    mockedEnablePush.mockResolvedValue({
      state: "error",
      message: "Permission denied",
    });

    const { result } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("disabled");
    });

    await act(async () => {
      await result.current.enablePush();
    });

    expect(result.current.state).toBe("error");
    expect(result.current.message).toBe("Permission denied");
  });

  it("tracks pending state during toggle actions", async () => {
    let resolveEnable: (value: {
      state: "enabled";
      message: null;
    }) => void = () => undefined;
    mockedGetPushStatus.mockResolvedValue({
      state: "disabled",
      message: null,
    });
    mockedEnablePush.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnable = resolve;
        }),
    );

    const { result } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("disabled");
    });

    let enablePromise!: Promise<void>;
    act(() => {
      enablePromise = result.current.enablePush();
    });

    await waitFor(() => {
      expect(result.current.pending).toBe(true);
    });

    await act(async () => {
      resolveEnable({ state: "enabled", message: null });
      await enablePromise;
    });

    expect(result.current.pending).toBe(false);
  });
});

describe("usePushNotificationToggle unmount actions", () => {
  setupPushToggleSuite();

  it("ignores refresh results after unmount", async () => {
    let resolveStatus: (value: {
      state: "enabled";
      message: null;
    }) => void = () => undefined;
    mockedGetPushStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => usePushNotificationToggle());

    unmount();
    await act(async () => {
      resolveStatus({ state: "enabled", message: null });
      await Promise.resolve();
    });

    expect(result.current.state).toBe("loading");
  });

  it("ignores enable results after unmount", async () => {
    mockedGetPushStatus.mockResolvedValue({
      state: "disabled",
      message: null,
    });
    let resolveEnable: (value: {
      state: "enabled";
      message: null;
    }) => void = () => undefined;
    mockedEnablePush.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnable = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => usePushNotificationToggle());

    await waitFor(() => {
      expect(result.current.state).toBe("disabled");
    });

    let enablePromise!: Promise<void>;
    act(() => {
      enablePromise = result.current.enablePush();
    });
    unmount();

    await act(async () => {
      resolveEnable({ state: "enabled", message: null });
      await enablePromise;
    });

    expect(result.current.state).toBe("disabled");
    expect(result.current.pending).toBe(true);
  });
});
