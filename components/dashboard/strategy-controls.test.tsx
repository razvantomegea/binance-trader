import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTestId } from "@/constants/data-test-id";
import type { CronAlert, StrategyStatus } from "@/components/dashboard/types";

import { StrategyControls } from "./strategy-controls";

vi.mock("@/components/push-notification-toggle", () => ({
  PushNotificationToggle: () => <div data-testid="push-toggle-mock" />,
}));

function makeStatus(overrides: Partial<StrategyStatus> = {}): StrategyStatus {
  return {
    running: false,
    runningNow: false,
    heartbeatMs: 60_000,
    startedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    lastError: null,
    ...overrides,
  };
}

function setupStrategyControlsSuite(): void {
  afterEach(() => {
    cleanup();
  });
}

describe("StrategyControls rendering", () => {
  setupStrategyControlsSuite();

  it("renders start strategy button when stopped", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus()}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyToggle)).toHaveTextContent(
      "Start strategy",
    );
    expect(screen.getByTestId("push-toggle-mock")).toBeInTheDocument();
  });

  it("renders stop strategy button when running", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus({ running: true })}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyToggle)).toHaveTextContent(
      "Stop strategy",
    );
  });

  it("disables toggle while action is pending", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus()}
        strategyActionPending
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyToggle)).toBeDisabled();
    expect(screen.getByTestId(DataTestId.StrategyToggle)).toHaveTextContent(
      "Please wait...",
    );
  });

  it("shows strategy status and run timestamps", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus({
          running: true,
          nextRunAt: "2026-06-07T12:05:00.000Z",
          lastRunAt: "2026-06-07T11:58:00.000Z",
        })}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyStatus)).toHaveTextContent(
      "Status: Started",
    );
    expect(screen.getByText(/Next run:/)).toBeInTheDocument();
    expect(screen.getByText(/Last run:/)).toBeInTheDocument();
  });

  it("renders cron alerts when present", () => {
    const cronAlerts: CronAlert[] = [
      {
        id: "stale-last-run",
        severity: "warning",
        message: "Cron looks stale",
      },
    ];

    render(
      <StrategyControls
        strategyStatus={makeStatus({ running: true })}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={cronAlerts}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.CronAlerts)).toBeInTheDocument();
    expect(screen.getByTestId(DataTestId.CronAlert)).toHaveTextContent(
      "Cron looks stale",
    );
  });

  it("shows running-now status and last error", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus({
          running: true,
          runningNow: true,
          lastError: "heartbeat timeout",
        })}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyStatus)).toHaveTextContent(
      "Status: Running now",
    );
    expect(
      screen.getByText(/Last error: heartbeat timeout/),
    ).toBeInTheDocument();
  });
});

describe("StrategyControls actions", () => {
  setupStrategyControlsSuite();

  it("disables start button while portfolio is loading", () => {
    render(
      <StrategyControls
        strategyStatus={makeStatus()}
        strategyActionPending={false}
        loadingPortfolio
        cronAlerts={[]}
        onToggleStrategy={vi.fn()}
      />,
    );

    expect(screen.getByTestId(DataTestId.StrategyToggle)).toBeDisabled();
  });

  it("calls onToggleStrategy when button is clicked", () => {
    const onToggleStrategy = vi.fn().mockResolvedValue(undefined);

    render(
      <StrategyControls
        strategyStatus={makeStatus()}
        strategyActionPending={false}
        loadingPortfolio={false}
        cronAlerts={[]}
        onToggleStrategy={onToggleStrategy}
      />,
    );

    fireEvent.click(screen.getByTestId(DataTestId.StrategyToggle));

    expect(onToggleStrategy).toHaveBeenCalledTimes(1);
  });
});
