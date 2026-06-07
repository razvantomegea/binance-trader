import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePushNotificationToggle } from "@/hooks/use-push-notification-toggle";

import { PushNotificationToggle } from "./push-notification-toggle";

vi.mock("@/hooks/use-push-notification-toggle");

const mockedUsePush = vi.mocked(usePushNotificationToggle);

describe("PushNotificationToggle", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders unsupported message when push is unavailable", () => {
    mockedUsePush.mockReturnValue({
      state: "unsupported",
      message: null,
      pending: false,
      isEnabled: false,
      refreshState: vi.fn(),
      enablePush: vi.fn(),
      disablePush: vi.fn(),
    });

    render(<PushNotificationToggle />);

    expect(
      screen.getByText("Push notifications are not supported in this browser."),
    ).toBeInTheDocument();
  });

  it("renders enable button when push is disabled", () => {
    mockedUsePush.mockReturnValue({
      state: "disabled",
      message: null,
      pending: false,
      isEnabled: false,
      refreshState: vi.fn(),
      enablePush: vi.fn(),
      disablePush: vi.fn(),
    });

    render(<PushNotificationToggle />);

    expect(
      screen.getByRole("button", { name: "Enable trade alerts" }),
    ).toBeInTheDocument();
  });

  it("renders disable button when push is enabled", () => {
    const disablePush = vi.fn().mockResolvedValue(undefined);
    mockedUsePush.mockReturnValue({
      state: "enabled",
      message: null,
      pending: false,
      isEnabled: true,
      refreshState: vi.fn(),
      enablePush: vi.fn(),
      disablePush,
    });

    render(<PushNotificationToggle />);

    fireEvent.click(
      screen.getByRole("button", { name: "Disable trade alerts" }),
    );

    expect(disablePush).toHaveBeenCalledTimes(1);
  });

  it("shows error message and disables button while pending", () => {
    mockedUsePush.mockReturnValue({
      state: "disabled",
      message: "Permission denied",
      pending: true,
      isEnabled: false,
      refreshState: vi.fn(),
      enablePush: vi.fn(),
      disablePush: vi.fn(),
    });

    render(<PushNotificationToggle />);

    expect(screen.getByText("Permission denied")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Please wait..." }),
    ).toBeDisabled();
  });
});
