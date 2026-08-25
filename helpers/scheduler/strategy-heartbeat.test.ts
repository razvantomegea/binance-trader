import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunStrategy = vi.fn();
const mockSetSchedulerRunning = vi.fn();
const mockGetSchedulerPersistedStatus = vi.fn();
const mockRecordSchedulerRun = vi.fn();

vi.mock("@/helpers/strategy/strategy-runner", () => ({
  runStrategy: (...args: unknown[]) => mockRunStrategy(...args),
}));

vi.mock("@/helpers/scheduler/strategy-scheduler-meta", () => ({
  getSchedulerPersistedStatus: (...args: unknown[]) =>
    mockGetSchedulerPersistedStatus(...args),
  recordSchedulerRun: (...args: unknown[]) => mockRecordSchedulerRun(...args),
  setSchedulerRunning: (...args: unknown[]) => mockSetSchedulerRunning(...args),
}));

import { STRATEGY_HEARTBEAT_MS } from "@/constants/cron";

import {
  getStrategyHeartbeatStatus,
  startStrategyHeartbeat,
  stopStrategyHeartbeat,
} from "./strategy-heartbeat";

function resetGlobalHeartbeatState() {
  delete globalThis.__strategyHeartbeatState;
}

function setupHeartbeatSuite(): void {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetGlobalHeartbeatState();
    mockSetSchedulerRunning.mockResolvedValue(undefined);
    mockRecordSchedulerRun.mockResolvedValue(undefined);
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: false,
      startedAtMs: null,
      lastRunAtMs: null,
      lastError: null,
      lastResult: null,
    });
    mockRunStrategy.mockResolvedValue({
      interval: "H1",
      symbolsEvaluated: 1,
      tradesExecuted: 0,
      cash: 10000,
      equity: 10000,
      postClose24hBackfill: { scanned: 0, updated: 0, skipped: 0 },
      maxPriceAfterBuyBackfill: { scanned: 0, updated: 0, skipped: 0 },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetGlobalHeartbeatState();
  });
}

describe("strategy-heartbeat lifecycle and scheduling", () => {
  setupHeartbeatSuite();

  it("starts heartbeat and returns status", async () => {
    const status = await startStrategyHeartbeat();

    expect(mockSetSchedulerRunning).toHaveBeenCalledWith(true);
    expect(status.running).toBe(true);
    expect(status.heartbeatMs).toBe(5 * 60 * 1000);
  });

  it("does not start duplicate loop when already running", async () => {
    await startStrategyHeartbeat();
    const second = await startStrategyHeartbeat();

    expect(second.running).toBe(true);
    expect(mockSetSchedulerRunning).toHaveBeenCalledTimes(2);
  });

  it("runs strategy at top of hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:00:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
    expect(mockRecordSchedulerRun).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.any(Object) }),
    );
  });

  it("records error when strategy run fails", async () => {
    vi.setSystemTime(new Date("2024-06-01T11:00:00.000Z"));
    mockRunStrategy.mockRejectedValueOnce(new Error("strategy boom"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);

    expect(mockRecordSchedulerRun).toHaveBeenCalledWith({
      error: "strategy boom",
    });
  });

  it("stops heartbeat and clears timer", async () => {
    await startStrategyHeartbeat();
    const status = await stopStrategyHeartbeat();

    expect(mockSetSchedulerRunning).toHaveBeenCalledWith(false);
    expect(status.running).toBe(false);
  });
});

describe("strategy-heartbeat state restoration and run constraints", () => {
  setupHeartbeatSuite();

  it("restores persisted running state on hydrate", async () => {
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: 5000,
      lastRunAtMs: 6000,
      lastError: "old",
      lastResult: null,
    });

    const status = await getStrategyHeartbeatStatus();

    expect(status.running).toBe(true);
    expect(status.lastError).toBe("old");
  });

  it("does not run strategy after the first 5 minutes of the hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:15:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);

    expect(mockRunStrategy).not.toHaveBeenCalled();
  });

  it("runs strategy in the first 5 minutes of the hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:03:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
  });

  it("runs restored scheduler inside the hourly window", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:01:00.000Z"));
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: 5000,
      lastRunAtMs: null,
      lastError: null,
      lastResult: null,
    });

    await getStrategyHeartbeatStatus();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
  });

  it("does not rerun H1 on restore when last run was the same hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:03:00.000Z"));
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: Date.parse("2024-06-01T09:00:00.000Z"),
      lastRunAtMs: Date.parse("2024-06-01T10:00:05.000Z"),
      lastError: null,
      lastResult: null,
    });

    await getStrategyHeartbeatStatus();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockRunStrategy).not.toHaveBeenCalled();
  });

  it("does not rerun strategy in the same hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
  });

  it("records generic failure message for non-Error throws", async () => {
    vi.setSystemTime(new Date("2024-06-01T13:00:00.000Z"));
    mockRunStrategy.mockRejectedValueOnce("plain failure");

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(STRATEGY_HEARTBEAT_MS);

    expect(mockRecordSchedulerRun).toHaveBeenCalledWith({
      error: "Strategy run failed",
    });
  });
});

describe("strategy-heartbeat shutdown behavior", () => {
  setupHeartbeatSuite();

  it("returns current status when stopping an idle heartbeat", async () => {
    const status = await stopStrategyHeartbeat();

    expect(status.running).toBe(false);
    expect(mockSetSchedulerRunning).toHaveBeenCalledWith(false);
  });

  it("waits for in-flight run before stopping", async () => {
    vi.setSystemTime(new Date("2024-06-01T14:00:00.000Z"));
    let resolveRun: (
      value: Awaited<ReturnType<typeof mockRunStrategy>>,
    ) => void = () => undefined;
    mockRunStrategy.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRun = resolve;
        }),
    );

    await startStrategyHeartbeat();
    const stopPromise = stopStrategyHeartbeat();

    resolveRun({
      interval: "H1",
      symbolsEvaluated: 1,
      tradesExecuted: 0,
      cash: 10000,
      equity: 10000,
      postClose24hBackfill: { scanned: 0, updated: 0, skipped: 0 },
      maxPriceAfterBuyBackfill: { scanned: 0, updated: 0, skipped: 0 },
    });
    await vi.advanceTimersByTimeAsync(5_000);

    const status = await stopPromise;
    expect(status.running).toBe(false);
    expect(mockRunStrategy).toHaveBeenCalledOnce();
  });

  it("uses current time when persisted startedAtMs is missing", async () => {
    vi.setSystemTime(new Date("2024-06-01T15:00:00.000Z"));
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: null,
      lastRunAtMs: null,
      lastError: null,
      lastResult: null,
    });

    const status = await getStrategyHeartbeatStatus();

    expect(status.running).toBe(true);
    expect(status.startedAt).toBe("2024-06-01T15:00:00.000Z");
  });
});
