import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db");
vi.mock("@/db/with-db-retry", () => ({
  withDbRetry: (op: () => Promise<unknown>) => op(),
}));

import { getDb } from "@/db";

import {
  getSchedulerPersistedStatus,
  getSchedulerRunning,
  isServerlessScheduler,
  recordSchedulerRun,
  setSchedulerRunning,
} from "./strategy-scheduler-meta";

const mockedGetDb = vi.mocked(getDb);

function mockMetaStore(store: Record<string, string | undefined>) {
  const limit = vi.fn().mockImplementation(async () => {
    const callIndex = limit.mock.calls.length - 1;
    const keys = [
      "scheduler_running",
      "scheduler_started_at",
      "scheduler_last_run_at",
      "scheduler_last_error",
      "scheduler_last_result",
    ];
    const key = keys[callIndex] ?? keys[0]!;
    const value = store[key];
    return value === undefined ? [] : [{ key, value }];
  });
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  mockedGetDb.mockReturnValue({
    select,
    insert,
  } as unknown as ReturnType<typeof getDb>);

  return { select, insert, values, limit };
}

describe("strategy-scheduler-meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SCHEDULER_MODE;
  });

  it("detects serverless scheduler mode", () => {
    process.env.SCHEDULER_MODE = "external-cron";
    expect(isServerlessScheduler()).toBe(true);
    delete process.env.SCHEDULER_MODE;
    expect(isServerlessScheduler()).toBe(false);
  });

  it("returns false when running meta is absent", async () => {
    mockMetaStore({});

    await expect(getSchedulerRunning()).resolves.toBe(false);
  });

  it("returns true when running meta is true", async () => {
    mockMetaStore({ scheduler_running: "true" });

    await expect(getSchedulerRunning()).resolves.toBe(true);
  });

  it("returns false when running meta is explicitly false", async () => {
    mockMetaStore({ scheduler_running: "false" });

    await expect(getSchedulerRunning()).resolves.toBe(false);
  });

  it("sets scheduler running and started_at", async () => {
    const { values } = mockMetaStore({});

    await setSchedulerRunning(true);

    expect(values).toHaveBeenCalled();
  });

  it("records scheduler run result and error", async () => {
    const { values } = mockMetaStore({});

    await recordSchedulerRun({
      result: {
        interval: "H1",
        symbolsEvaluated: 2,
        tradesExecuted: 1,
        cash: 1000,
        equity: 1100,
        postClose24hBackfill: { scanned: 0, updated: 0, skipped: 0 },
        maxPriceAfterBuyBackfill: { scanned: 0, updated: 0, skipped: 0 },
      },
      error: "",
    });

    expect(values).toHaveBeenCalled();
  });

  it("hydrates persisted status with parsed last result", async () => {
    mockMetaStore({
      scheduler_running: "true",
      scheduler_started_at: "1000",
      scheduler_last_run_at: "2000",
      scheduler_last_error: "",
      scheduler_last_result: JSON.stringify({
        interval: "H1",
        symbolsEvaluated: 1,
        tradesExecuted: 0,
        cash: 10000,
        equity: 10000,
        postClose24hBackfill: { scanned: 0, updated: 0, skipped: 0 },
        maxPriceAfterBuyBackfill: { scanned: 0, updated: 0, skipped: 0 },
      }),
    });

    const status = await getSchedulerPersistedStatus();

    expect(status.running).toBe(true);
    expect(status.startedAtMs).toBe(1000);
    expect(status.lastRunAtMs).toBe(2000);
    expect(status.lastError).toBeNull();
    expect(status.lastResult?.symbolsEvaluated).toBe(1);
  });

  it("returns null lastResult when JSON is invalid", async () => {
    mockMetaStore({
      scheduler_running: "false",
      scheduler_last_result: "{bad",
    });

    const status = await getSchedulerPersistedStatus();

    expect(status.lastResult).toBeNull();
  });

  it("sets scheduler stopped without started_at", async () => {
    const { values } = mockMetaStore({});

    await setSchedulerRunning(false);

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ key: "scheduler_running", value: "false" }),
    );
  });

  it("normalizes empty error meta and invalid timestamps", async () => {
    mockMetaStore({
      scheduler_running: "false",
      scheduler_started_at: "not-a-number",
      scheduler_last_run_at: "",
      scheduler_last_error: "scheduler failed",
    });

    const status = await getSchedulerPersistedStatus();

    expect(status.startedAtMs).toBeNull();
    expect(status.lastRunAtMs).toBeNull();
    expect(status.lastError).toBe("scheduler failed");
  });
});
