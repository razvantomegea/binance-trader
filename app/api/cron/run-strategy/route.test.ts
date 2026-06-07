import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/scheduler/strategy-scheduler-meta");
vi.mock("@/helpers/strategy/strategy-runner");

import {
  getSchedulerRunning,
  recordSchedulerRun,
} from "@/helpers/scheduler/strategy-scheduler-meta";
import { runStrategy } from "@/helpers/strategy/strategy-runner";

import { GET, POST } from "./route";

const mockedGetSchedulerRunning = vi.mocked(getSchedulerRunning);
const mockedRunStrategy = vi.mocked(runStrategy);
const mockedRecordSchedulerRun = vi.mocked(recordSchedulerRun);

const BASE_URL = "http://test.local/api/cron/run-strategy";
const CRON_SECRET = "test-cron-secret";

function authorizedRequest(method: "GET" | "POST"): Request {
  return new Request(BASE_URL, {
    method,
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

const runResult = {
  interval: "H1" as const,
  symbolsEvaluated: 2,
  tradesExecuted: 0,
  cash: 1000,
  equity: 1000,
  postClose24hBackfill: { scanned: 0, updated: 0, skipped: 0 },
  maxPriceAfterBuyBackfill: { scanned: 0, updated: 0, skipped: 0 },
};

describe("/api/cron/run-strategy", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    mockedGetSchedulerRunning.mockReset();
    mockedRunStrategy.mockReset();
    mockedRecordSchedulerRun.mockReset();
    mockedRecordSchedulerRun.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const response = await GET(new Request(BASE_URL));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns skipped payload when scheduler is stopped", async () => {
    mockedGetSchedulerRunning.mockResolvedValue(false);

    const response = await GET(authorizedRequest("GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      skipped: true,
      reason: "scheduler stopped",
    });
    expect(mockedRunStrategy).not.toHaveBeenCalled();
  });

  it("returns 500 when strategy run fails", async () => {
    mockedGetSchedulerRunning.mockResolvedValue(true);
    mockedRunStrategy.mockRejectedValue(new Error("strategy failed"));

    const response = await POST(authorizedRequest("POST"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "strategy failed",
    });
    expect(mockedRecordSchedulerRun).toHaveBeenCalledWith({
      error: "strategy failed",
    });
  });

  it("returns fallback error message for non-Error failures", async () => {
    mockedGetSchedulerRunning.mockResolvedValue(true);
    mockedRunStrategy.mockRejectedValue("strategy failed");

    const response = await POST(authorizedRequest("POST"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Strategy run failed",
    });
    expect(mockedRecordSchedulerRun).toHaveBeenCalledWith({
      error: "Strategy run failed",
    });
  });

  it("returns 200 with run result on success", async () => {
    mockedGetSchedulerRunning.mockResolvedValue(true);
    mockedRunStrategy.mockResolvedValue(runResult);

    const response = await POST(authorizedRequest("POST"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(runResult);
    expect(mockedRecordSchedulerRun).toHaveBeenCalledWith({
      result: runResult,
    });
  });
});
