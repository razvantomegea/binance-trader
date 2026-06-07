import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STRATEGY_CRON_NO_RUN_AFTER_START_MS,
  STRATEGY_CRON_STALE_MS,
} from "@/constants/cron";

import { buildCronAlerts } from "./cron-alerts";
import type { StrategyStatus } from "./types";

const NOW_MS = Date.parse("2026-06-07T12:00:00.000Z");

function makeStatus(overrides: Partial<StrategyStatus> = {}): StrategyStatus {
  return {
    running: true,
    runningNow: false,
    heartbeatMs: 30_000,
    startedAt: "2026-06-07T11:00:00.000Z",
    lastRunAt: "2026-06-07T11:58:00.000Z",
    nextRunAt: "2026-06-07T12:05:00.000Z",
    lastError: null,
    ...overrides,
  };
}

describe("buildCronAlerts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("adds status request error alert", () => {
    const alerts = buildCronAlerts({
      strategyStatus: null,
      statusRequestError: "Failed to load status",
      actionError: null,
    });

    expect(alerts).toEqual([
      {
        id: "status-request-error",
        severity: "error",
        message: "Failed to load status",
      },
    ]);
  });

  it("adds strategy action error alert", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus(),
      statusRequestError: null,
      actionError: "Start failed",
    });

    expect(alerts).toContainEqual({
      id: "strategy-action-error",
      severity: "error",
      message: "Start failed",
    });
  });

  it("returns only request errors when strategy status is null", () => {
    const alerts = buildCronAlerts({
      strategyStatus: null,
      statusRequestError: "status down",
      actionError: "action down",
    });

    expect(alerts.map((alert) => alert.id)).toEqual([
      "status-request-error",
      "strategy-action-error",
    ]);
  });

  it("adds last run error alert from strategy status", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus({ lastError: "db timeout" }),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toContainEqual({
      id: "last-run-error",
      severity: "error",
      message: "Last strategy run failed: db timeout",
    });
  });

  it("does not add running-state alerts when strategy is not running", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus({
        running: false,
        lastRunAt: null,
        startedAt: "2026-06-07T10:00:00.000Z",
      }),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toEqual([]);
  });

  it("adds stale cron alert when last successful run is too old", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus({
        lastRunAt: new Date(NOW_MS - STRATEGY_CRON_STALE_MS - 1).toISOString(),
      }),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toContainEqual({
      id: "stale-last-run",
      severity: "warning",
      message: "Cron looks stale: no successful run in the last 40 minutes.",
    });
  });

  it("adds never-ran-after-start alert when running with no recorded run", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus({
        lastRunAt: null,
        startedAt: new Date(
          NOW_MS - STRATEGY_CRON_NO_RUN_AFTER_START_MS - 1,
        ).toISOString(),
      }),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toContainEqual({
      id: "never-ran-after-start",
      severity: "warning",
      message: "Strategy started but no successful run has been recorded yet.",
    });
  });

  it("returns no running-state alerts for healthy running strategy", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus(),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toEqual([]);
  });

  it("ignores invalid ISO timestamps for running-state checks", () => {
    const alerts = buildCronAlerts({
      strategyStatus: makeStatus({
        lastRunAt: "not-a-date",
        startedAt: "also-bad",
      }),
      statusRequestError: null,
      actionError: null,
    });

    expect(alerts).toEqual([]);
  });
});
