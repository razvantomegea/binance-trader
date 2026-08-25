import {
  STRATEGY_CRON_NO_RUN_AFTER_START_MS,
  STRATEGY_CRON_STALE_MS,
} from "@/constants/cron";

import type { CronAlert, StrategyStatus } from "@/components/dashboard/types";

function parseIsoToMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

/** Runs recorded before the current start (e.g. after DB migrate) do not count. */
function lastRunSinceStartMs({
  lastRunAtMs,
  startedAtMs,
}: {
  lastRunAtMs: number | null;
  startedAtMs: number | null;
}): number | null {
  if (lastRunAtMs === null) {
    return null;
  }
  if (startedAtMs !== null && lastRunAtMs < startedAtMs) {
    return null;
  }
  return lastRunAtMs;
}

function getStaleCronAlert({
  nowMs,
  lastRunAtMs,
}: {
  nowMs: number;
  lastRunAtMs: number | null;
}): CronAlert | null {
  if (!lastRunAtMs || nowMs - lastRunAtMs <= STRATEGY_CRON_STALE_MS) {
    return null;
  }
  return {
    id: "stale-last-run",
    severity: "warning",
    message:
      "Scheduler looks stale: no successful run in the last ~70 minutes.",
  };
}

function getNeverRanAfterStartAlert({
  nowMs,
  lastRunAtMs,
  startedAtMs,
}: {
  nowMs: number;
  lastRunAtMs: number | null;
  startedAtMs: number | null;
}): CronAlert | null {
  if (
    lastRunAtMs ||
    !startedAtMs ||
    nowMs - startedAtMs <= STRATEGY_CRON_NO_RUN_AFTER_START_MS
  ) {
    return null;
  }
  return {
    id: "never-ran-after-start",
    severity: "warning",
    message: "Strategy started but no successful run has been recorded yet.",
  };
}

export function buildCronAlerts({
  strategyStatus,
  statusRequestError,
  actionError,
}: {
  strategyStatus: StrategyStatus | null;
  statusRequestError: string | null;
  actionError: string | null;
}): CronAlert[] {
  const alerts: CronAlert[] = [];

  if (statusRequestError) {
    alerts.push({
      id: "status-request-error",
      severity: "error",
      message: statusRequestError,
    });
  }
  if (actionError) {
    alerts.push({
      id: "strategy-action-error",
      severity: "error",
      message: actionError,
    });
  }
  if (!strategyStatus) {
    return alerts;
  }

  addLastRunErrorAlert(alerts, strategyStatus.lastError);
  addRunningStateAlerts(alerts, strategyStatus);
  return alerts;
}

function addLastRunErrorAlert(
  alerts: CronAlert[],
  lastError: string | null,
): void {
  if (!lastError) {
    return;
  }
  alerts.push({
    id: "last-run-error",
    severity: "error",
    message: `Last strategy run failed: ${lastError}`,
  });
}

function addRunningStateAlerts(
  alerts: CronAlert[],
  strategyStatus: StrategyStatus,
): void {
  if (!strategyStatus.running) {
    return;
  }
  const nowMs = Date.now();
  const startedAtMs = parseIsoToMs(strategyStatus.startedAt);
  const lastRunAtMs = lastRunSinceStartMs({
    lastRunAtMs: parseIsoToMs(strategyStatus.lastRunAt),
    startedAtMs,
  });
  const staleAlert = getStaleCronAlert({ nowMs, lastRunAtMs });
  const neverRanAlert = getNeverRanAfterStartAlert({
    nowMs,
    lastRunAtMs,
    startedAtMs,
  });
  if (staleAlert) {
    alerts.push(staleAlert);
  }
  if (neverRanAlert) {
    alerts.push(neverRanAlert);
  }
}
