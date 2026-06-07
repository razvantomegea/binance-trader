import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStartStrategyHeartbeat = vi.fn();

vi.mock("@/helpers/scheduler/strategy-heartbeat", () => ({
  startStrategyHeartbeat: (...args: unknown[]) =>
    mockStartStrategyHeartbeat(...args),
}));

import { startCron } from "./start-cron";

describe("startCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartStrategyHeartbeat.mockResolvedValue({
      running: true,
      runningNow: false,
      heartbeatMs: 15000,
      startedAt: null,
      lastRunAt: null,
      nextRunAt: null,
      lastError: null,
      lastResult: null,
    });
  });

  it("delegates to startStrategyHeartbeat", () => {
    startCron();

    expect(mockStartStrategyHeartbeat).toHaveBeenCalledOnce();
  });
});
