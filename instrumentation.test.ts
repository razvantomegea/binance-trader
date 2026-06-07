import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockStartCron = vi.fn();

vi.mock("@/helpers/scheduler/start-cron", () => ({
  startCron: (...args: unknown[]) => mockStartCron(...args),
}));

describe("instrumentation register", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.NEXT_RUNTIME;
    delete process.env.AUTO_START_STRATEGY;
  });

  afterEach(() => {
    delete process.env.NEXT_RUNTIME;
    delete process.env.AUTO_START_STRATEGY;
  });

  it("does not start cron when NEXT_RUNTIME is not nodejs", async () => {
    process.env.NEXT_RUNTIME = "edge";
    process.env.AUTO_START_STRATEGY = "true";

    const { register } = await import("./instrumentation");
    await register();

    expect(mockStartCron).not.toHaveBeenCalled();
  });

  it("does not start cron when AUTO_START_STRATEGY is not true", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.AUTO_START_STRATEGY = "false";

    const { register } = await import("./instrumentation");
    await register();

    expect(mockStartCron).not.toHaveBeenCalled();
  });

  it("starts cron when nodejs runtime and auto start enabled", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.AUTO_START_STRATEGY = "true";

    const { register } = await import("./instrumentation");
    await register();

    expect(mockStartCron).toHaveBeenCalledOnce();
  });
});
