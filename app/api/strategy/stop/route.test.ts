import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/scheduler/strategy-heartbeat");

import { stopStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

import { POST } from "./route";

const mockedStopStrategyHeartbeat = vi.mocked(stopStrategyHeartbeat);

const BASE_URL = "http://test.local/api/strategy/stop";
const CRON_SECRET = "test-cron-secret";

function authorizedPost(): Request {
  return new Request(BASE_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("POST /api/strategy/stop", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
    mockedStopStrategyHeartbeat.mockReset();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without cron secret", async () => {
    const response = await POST(new Request(BASE_URL, { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when stop fails", async () => {
    mockedStopStrategyHeartbeat.mockRejectedValue(new Error("stop failed"));

    const response = await POST(authorizedPost());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal Server Error",
    });
  });

  it("returns 200 with heartbeat status", async () => {
    const status = {
      running: false,
      runningNow: false,
      heartbeatMs: 15000,
      startedAt: null,
      lastRunAt: null,
      nextRunAt: null,
      lastError: null,
      lastResult: null,
    };
    mockedStopStrategyHeartbeat.mockResolvedValue(status);

    const response = await POST(authorizedPost());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(status);
  });
});
