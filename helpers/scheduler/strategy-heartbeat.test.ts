import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRunStrategy = vi.fn();
const mockSetSchedulerRunning = vi.fn();
const mockGetSchedulerPersistedStatus = vi.fn();
const mockRecordSchedulerRun = vi.fn();
const mockIsServerlessScheduler = vi.fn();

vi.mock("@/helpers/strategy/strategy-runner", () => ({
  runStrategy: (...args: unknown[]) => mockRunStrategy(...args),
}));

vi.mock("@/helpers/scheduler/strategy-scheduler-meta", () => ({
  getSchedulerPersistedStatus: (...args: unknown[]) =>
    mockGetSchedulerPersistedStatus(...args),
  isServerlessScheduler: (...args: unknown[]) =>
    mockIsServerlessScheduler(...args),
  recordSchedulerRun: (...args: unknown[]) => mockRecordSchedulerRun(...args),
  setSchedulerRunning: (...args: unknown[]) => mockSetSchedulerRunning(...args),
}));

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
    mockIsServerlessScheduler.mockReturnValue(false);
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
    expect(status.heartbeatMs).toBe(15_000);
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
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
    expect(mockRecordSchedulerRun).toHaveBeenCalledWith(
      expect.objectContaining({ result: expect.any(Object) }),
    );
  });

  it("records error when strategy run fails", async () => {
    vi.setSystemTime(new Date("2024-06-01T11:00:00.000Z"));
    mockRunStrategy.mockRejectedValueOnce(new Error("strategy boom"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(15_000);

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

  it("returns serverless status without local timer", async () => {
    mockIsServerlessScheduler.mockReturnValue(true);
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: 1000,
      lastRunAtMs: 2000,
      lastError: null,
      lastResult: null,
    });

    const status = await getStrategyHeartbeatStatus();

    expect(status.running).toBe(true);
    expect(status.runningNow).toBe(false);
    expect(status.nextRunAt).not.toBeNull();
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

  it("does not run strategy off the top of the hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T10:15:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockRunStrategy).not.toHaveBeenCalled();
  });

  it("does not rerun strategy in the same hour", async () => {
    vi.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockRunStrategy).toHaveBeenCalledOnce();
  });

  it("records generic failure message for non-Error throws", async () => {
    vi.setSystemTime(new Date("2024-06-01T13:00:00.000Z"));
    mockRunStrategy.mockRejectedValueOnce("plain failure");

    await startStrategyHeartbeat();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(mockRecordSchedulerRun).toHaveBeenCalledWith({
      error: "Strategy run failed",
    });
  });
});

describe("strategy-heartbeat serverless and shutdown behavior", () => {
  setupHeartbeatSuite();

  it("starts and stops in serverless mode", async () => {
    mockIsServerlessScheduler.mockReturnValue(true);
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: true,
      startedAtMs: 1000,
      lastRunAtMs: 2000,
      lastError: null,
      lastResult: null,
    });

    const started = await startStrategyHeartbeat();
    expect(started.running).toBe(true);
    expect(started.runningNow).toBe(false);

    const stopped = await stopStrategyHeartbeat();
    expect(stopped.running).toBe(true);
    expect(mockSetSchedulerRunning).toHaveBeenCalledWith(false);
  });

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

  it("returns serverless status with null schedule fields when stopped", async () => {
    mockIsServerlessScheduler.mockReturnValue(true);
    mockGetSchedulerPersistedStatus.mockResolvedValue({
      running: false,
      startedAtMs: null,
      lastRunAtMs: null,
      lastError: null,
      lastResult: null,
    });

    const status = await getStrategyHeartbeatStatus();

    expect(status.running).toBe(false);
    expect(status.startedAt).toBeNull();
    expect(status.lastRunAt).toBeNull();
    expect(status.nextRunAt).toBeNull();
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
