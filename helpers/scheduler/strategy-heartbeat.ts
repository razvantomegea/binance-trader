import {
  getSchedulerPersistedStatus,
  isServerlessScheduler,
  setSchedulerRunning,
} from "@/helpers/scheduler/strategy-scheduler-meta";
import {
  runStrategy,
  type RunStrategyResult,
} from "@/helpers/strategy/strategy-runner";

const HEARTBEAT_MS = 15_000;
const STOP_WAIT_TIMEOUT_MS = 5_000;
const STOP_WAIT_POLL_MS = 50;

interface StrategyHeartbeatState {
  running: boolean;
  startedAtMs: number | null;
  lastRunAtMs: number | null;
  lastCompletedHourKey: string | null;
  runningNow: boolean;
  lastError: string | null;
  lastResult: RunStrategyResult | null;
  timer: NodeJS.Timeout | null;
}

export interface StrategyHeartbeatStatus {
  running: boolean;
  runningNow: boolean;
  heartbeatMs: number;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
  lastResult: RunStrategyResult | null;
}

declare global {
  var __strategyHeartbeatState: StrategyHeartbeatState | undefined;
}

function getState(): StrategyHeartbeatState {
  if (!globalThis.__strategyHeartbeatState) {
    globalThis.__strategyHeartbeatState = {
      running: false,
      startedAtMs: null,
      lastRunAtMs: null,
      lastCompletedHourKey: null,
      runningNow: false,
      lastError: null,
      lastResult: null,
      timer: null,
    };
  }

  return globalThis.__strategyHeartbeatState;
}

function toHourKey(tsMs: number): string {
  const date = new Date(tsMs);
  return [
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
  ].join("-");
}

function isTopOfHour(tsMs: number): boolean {
  const date = new Date(tsMs);
  return date.getUTCMinutes() === 0;
}

function computeNextRunIso(tsMs: number): string {
  const date = new Date(tsMs);
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString();
}

async function runIfNeeded(state: StrategyHeartbeatState): Promise<void> {
  if (!state.running || state.runningNow) {
    return;
  }

  const nowMs = Date.now();
  if (!isTopOfHour(nowMs)) {
    return;
  }

  const hourKey = toHourKey(nowMs);
  if (state.lastCompletedHourKey === hourKey) {
    return;
  }

  state.runningNow = true;
  state.lastError = null;

  try {
    const result = await runStrategy();
    state.lastRunAtMs = Date.now();
    state.lastCompletedHourKey = hourKey;
    state.lastResult = result;
    console.info(
      `[heartbeat] H1 done: trades=${result.tradesExecuted} equity=${result.equity.toFixed(2)}`,
    );
  } catch (error) {
    state.lastCompletedHourKey = hourKey;
    state.lastError =
      error instanceof Error ? error.message : "Strategy run failed";
    console.error("[heartbeat] H1 failed", error);
  } finally {
    state.runningNow = false;
  }
}

function toStatus(state: StrategyHeartbeatState): StrategyHeartbeatStatus {
  return {
    running: state.running,
    runningNow: state.runningNow,
    heartbeatMs: HEARTBEAT_MS,
    startedAt: state.startedAtMs
      ? new Date(state.startedAtMs).toISOString()
      : null,
    lastRunAt: state.lastRunAtMs
      ? new Date(state.lastRunAtMs).toISOString()
      : null,
    nextRunAt: state.running ? computeNextRunIso(Date.now()) : null,
    lastError: state.lastError,
    lastResult: state.lastResult,
  };
}

async function toServerlessStatus(): Promise<StrategyHeartbeatStatus> {
  const persisted = await getSchedulerPersistedStatus();

  return {
    running: persisted.running,
    runningNow: false,
    heartbeatMs: HEARTBEAT_MS,
    startedAt: persisted.startedAtMs
      ? new Date(persisted.startedAtMs).toISOString()
      : null,
    lastRunAt: persisted.lastRunAtMs
      ? new Date(persisted.lastRunAtMs).toISOString()
      : null,
    nextRunAt: persisted.running ? computeNextRunIso(Date.now()) : null,
    lastError: persisted.lastError,
    lastResult: persisted.lastResult,
  };
}

export async function getStrategyHeartbeatStatus(): Promise<StrategyHeartbeatStatus> {
  if (isServerlessScheduler()) {
    return toServerlessStatus();
  }

  return toStatus(getState());
}

export async function startStrategyHeartbeat(): Promise<StrategyHeartbeatStatus> {
  await setSchedulerRunning(true);

  if (isServerlessScheduler()) {
    console.info("[heartbeat] strategy scheduler enabled (Railway cron)");
    return toServerlessStatus();
  }

  const state = getState();
  if (state.running) {
    return toStatus(state);
  }

  state.running = true;
  state.startedAtMs = Date.now();
  state.lastError = null;
  state.timer = setInterval(() => {
    void runIfNeeded(state);
  }, HEARTBEAT_MS);

  void runIfNeeded(state);
  console.info("[heartbeat] strategy scheduler started");
  return toStatus(state);
}

async function waitForInFlightRun(
  state: StrategyHeartbeatState,
): Promise<void> {
  const startedAtMs = Date.now();
  while (state.runningNow && Date.now() - startedAtMs < STOP_WAIT_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, STOP_WAIT_POLL_MS));
  }
}

export async function stopStrategyHeartbeat(): Promise<StrategyHeartbeatStatus> {
  await setSchedulerRunning(false);

  if (isServerlessScheduler()) {
    console.info("[heartbeat] strategy scheduler disabled (Railway cron)");
    return toServerlessStatus();
  }

  const state = getState();
  if (!state.running) {
    return toStatus(state);
  }

  state.running = false;
  await waitForInFlightRun(state);
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }

  console.info("[heartbeat] strategy scheduler stopped");
  return toStatus(state);
}
