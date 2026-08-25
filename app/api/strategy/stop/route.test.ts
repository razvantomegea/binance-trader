import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/scheduler/strategy-heartbeat");

import { stopStrategyHeartbeat } from "@/helpers/scheduler/strategy-heartbeat";

import { POST } from "./route";

const mockedStopStrategyHeartbeat = vi.mocked(stopStrategyHeartbeat);

describe("POST /api/strategy/stop", () => {
  beforeEach(() => {
    mockedStopStrategyHeartbeat.mockReset();
  });

  it("returns 500 when stop fails", async () => {
    mockedStopStrategyHeartbeat.mockRejectedValue(new Error("stop failed"));

    const response = await POST();

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

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(status);
  });
});
