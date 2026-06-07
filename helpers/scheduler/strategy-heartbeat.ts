import {
  getSchedulerPersistedStatus,
  isServerlessScheduler,
  recordSchedulerRun,
  setSchedulerRunning,
} from "@/helpers/scheduler/strategy-scheduler-meta";
import {
  runStrategy,
  type RunStrategyResult,
} from "@/helpers/strategy/strategy-runner";
import { computeNextStrategyCronRunIso } from "@/utils/scheduler/compute-next-cron-run";

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
  hydratedFromMeta: boolean;
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
  globalThis.__strategyHeartbeatState ??= {
    running: false,
    startedAtMs: null,
    lastRunAtMs: null,
    lastCompletedHourKey: null,
    runningNow: false,
    lastError: null,
    lastResult: null,
    timer: null,
    hydratedFromMeta: false,
  };

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

function computeNextHourlyRunIso(tsMs: number): string {
  const date = new Date(tsMs);
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date.toISOString();
}

async function runIfNeeded(state: StrategyHeartbeatState): Promise<void> {
  const nowMs = Date.now();
  if (!shouldRun(state, nowMs)) {
    return;
  }
  await runScheduledCycle(state, toHourKey(nowMs));
}

function shouldRun(state: StrategyHeartbeatState, nowMs: number): boolean {
  if (!state.running || state.runningNow || !isTopOfHour(nowMs)) {
    return false;
  }
  return state.lastCompletedHourKey !== toHourKey(nowMs);
}

async function runScheduledCycle(
  state: StrategyHeartbeatState,
  hourKey: string,
): Promise<void> {
  state.runningNow = true;
  state.lastError = null;

  try {
    const result = await runStrategy();
    state.lastRunAtMs = Date.now();
    state.lastCompletedHourKey = hourKey;
    state.lastResult = result;
    await recordSchedulerRun({ result });
    console.info(
      `[heartbeat] H1 done: trades=${result.tradesExecuted} equity=${result.equity.toFixed(2)}`,
    );
  } catch (error) {
    await handleCycleFailure(state, hourKey, error);
  } finally {
    state.runningNow = false;
  }
}

async function handleCycleFailure(
  state: StrategyHeartbeatState,
  hourKey: string,
  error: unknown,
): Promise<void> {
  state.lastCompletedHourKey = hourKey;
  const message = error instanceof Error ? error.message : "Strategy run failed";
  state.lastError = message;
  await recordSchedulerRun({ error: message });
  console.error("[heartbeat] H1 failed", error);
}

function startHeartbeatLoop(state: StrategyHeartbeatState): void {
  if (state.timer) {
    return;
  }
  state.timer = setInterval(() => {
    void runIfNeeded(state);
  }, HEARTBEAT_MS);
}

async function ensureStateHydrated(
  state: StrategyHeartbeatState,
): Promise<void> {
  if (state.hydratedFromMeta) {
    return;
  }

  state.hydratedFromMeta = true;
  const persisted = await getSchedulerPersistedStatus();
  if (!persisted.running) {
    return;
  }

  state.running = true;
  state.startedAtMs = persisted.startedAtMs ?? Date.now();
  state.lastRunAtMs = persisted.lastRunAtMs;
  state.lastError = persisted.lastError;
  state.lastResult = persisted.lastResult;
  startHeartbeatLoop(state);
  console.info("[heartbeat] strategy scheduler restored from persisted state");
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
    nextRunAt: state.running ? computeNextHourlyRunIso(Date.now()) : null,
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
    nextRunAt: persisted.running
      ? computeNextStrategyCronRunIso(Date.now())
      : null,
    lastError: persisted.lastError,
    lastResult: persisted.lastResult,
  };
}

export async function getStrategyHeartbeatStatus(): Promise<StrategyHeartbeatStatus> {
  if (isServerlessScheduler()) {
    return toServerlessStatus();
  }

  const state = getState();
  await ensureStateHydrated(state);
  return toStatus(state);
}

export async function startStrategyHeartbeat(): Promise<StrategyHeartbeatStatus> {
  await setSchedulerRunning(true);

  if (isServerlessScheduler()) {
    console.info("[heartbeat] strategy scheduler enabled (Railway cron)");
    return toServerlessStatus();
  }

  const state = getState();
  await ensureStateHydrated(state);
  if (state.running) {
    return toStatus(state);
  }

  state.running = true;
  state.startedAtMs = Date.now();
  state.lastError = null;
  startHeartbeatLoop(state);

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
