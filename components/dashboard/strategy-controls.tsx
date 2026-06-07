import { PushNotificationToggle } from "@/components/push-notification-toggle";
import { DataTestId } from "@/constants/data-test-id";

import type {
  CronAlert,
  CronAlertSeverity,
  StrategyStatus,
} from "@/components/dashboard/types";

function getStrategyButtonLabel({
  strategyActionPending,
  strategyStatus,
}: {
  strategyActionPending: boolean;
  strategyStatus: StrategyStatus | null;
}): string {
  if (strategyActionPending) {
    return "Please wait...";
  }
  if (strategyStatus?.running) {
    return "Stop strategy";
  }
  return "Start strategy";
}

function getStrategyButtonClassName(running: boolean): string {
  const stateClassName = running
    ? "bg-rose-600 hover:bg-rose-500"
    : "bg-emerald-600 hover:bg-emerald-500";
  return `rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${stateClassName}`;
}

function getStrategyStatusLabel(strategyStatus: StrategyStatus | null): string {
  if (strategyStatus?.runningNow) {
    return "Running now";
  }
  if (strategyStatus?.running) {
    return "Started";
  }
  return "Stopped";
}

function getCronAlertClassName(severity: CronAlertSeverity): string {
  if (severity === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200";
  }
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200";
}

export function StrategyControls({
  strategyStatus,
  strategyActionPending,
  loadingPortfolio,
  cronAlerts,
  onToggleStrategy,
}: {
  strategyStatus: StrategyStatus | null;
  strategyActionPending: boolean;
  loadingPortfolio: boolean;
  cronAlerts: CronAlert[];
  onToggleStrategy: () => Promise<void>;
}) {
  const disableStrategyButton =
    strategyActionPending || (loadingPortfolio && !strategyStatus?.running);
  const statusLabel = getStrategyStatusLabel(strategyStatus);
  const buttonLabel = getStrategyButtonLabel({
    strategyActionPending,
    strategyStatus,
  });
  const buttonClassName = getStrategyButtonClassName(
    Boolean(strategyStatus?.running),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <PushNotificationToggle />
        <button
          type="button"
          data-testid={DataTestId.StrategyToggle}
          onClick={() => void onToggleStrategy()}
          disabled={disableStrategyButton}
          className={buttonClassName}
        >
          {buttonLabel}
        </button>
      </div>
      <StrategyStatusRow
        strategyStatus={strategyStatus}
        statusLabel={statusLabel}
      />
      <CronAlertsList cronAlerts={cronAlerts} />
    </>
  );
}

function StrategyStatusRow({
  strategyStatus,
  statusLabel,
}: {
  strategyStatus: StrategyStatus | null;
  statusLabel: string;
}) {
  return (
    <div
      className="mt-2 w-full text-xs text-zinc-500"
      data-testid={DataTestId.StrategyStatus}
    >
      <span className="inline-flex items-center gap-2">
        <span>Status: {statusLabel}</span>
        {strategyStatus?.running && strategyStatus.nextRunAt ? (
          <span>
            Next run: {new Date(strategyStatus.nextRunAt).toLocaleString()}
          </span>
        ) : null}
        {strategyStatus?.lastRunAt ? (
          <span>
            Last run: {new Date(strategyStatus.lastRunAt).toLocaleString()}
          </span>
        ) : null}
        {strategyStatus?.lastError ? (
          <span className="text-rose-500">
            Last error: {strategyStatus.lastError}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function CronAlertsList({ cronAlerts }: { cronAlerts: CronAlert[] }) {
  if (cronAlerts.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 w-full space-y-2" data-testid={DataTestId.CronAlerts}>
      {cronAlerts.map((alert) => (
        <p
          key={alert.id}
          data-testid={DataTestId.CronAlert}
          className={`rounded-md border px-3 py-2 text-sm ${getCronAlertClassName(alert.severity)}`}
        >
          {alert.message}
        </p>
      ))}
    </div>
  );
}
