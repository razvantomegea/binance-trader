import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/helpers/scheduler/strategy-heartbeat");

import { getStrategyHeartbeatStatus } from "@/helpers/scheduler/strategy-heartbeat";

import { GET } from "./route";

const mockedGetStrategyHeartbeatStatus = vi.mocked(getStrategyHeartbeatStatus);

describe("GET /api/strategy/status", () => {
  beforeEach(() => {
    mockedGetStrategyHeartbeatStatus.mockReset();
  });

  it("returns 503 on retryable db error", async () => {
    mockedGetStrategyHeartbeatStatus.mockRejectedValue(
      new Error("Control plane request failed"),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Internal Server Error",
    });
  });

  it("returns 500 on non-retryable error", async () => {
    mockedGetStrategyHeartbeatStatus.mockRejectedValue(
      new Error("unexpected failure"),
    );

    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Internal Server Error",
    });
  });

  it("returns 200 with heartbeat status", async () => {
    const status = {
      running: true,
      runningNow: false,
      heartbeatMs: 15000,
      startedAt: "2024-01-01T00:00:00.000Z",
      lastRunAt: null,
      nextRunAt: "2024-01-01T01:00:00.000Z",
      lastError: null,
      lastResult: null,
    };
    mockedGetStrategyHeartbeatStatus.mockResolvedValue(status);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(status);
  });
});
