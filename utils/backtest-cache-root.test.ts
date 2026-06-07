import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBacktestCacheRoot } from "./backtest-cache-root";

describe("getBacktestCacheRoot", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns default cache dir under cwd when env is unset", () => {
    vi.stubEnv("BACKTEST_CACHE_DIR", "");

    expect(getBacktestCacheRoot()).toBe(join(process.cwd(), "backtest-cache"));
  });

  it("returns default cache dir when env is the default name", () => {
    vi.stubEnv("BACKTEST_CACHE_DIR", "backtest-cache");

    expect(getBacktestCacheRoot()).toBe(join(process.cwd(), "backtest-cache"));
  });

  it("returns default cache dir when env is whitespace", () => {
    vi.stubEnv("BACKTEST_CACHE_DIR", "   ");

    expect(getBacktestCacheRoot()).toBe(join(process.cwd(), "backtest-cache"));
  });

  it("resolves relative configured path from cwd", () => {
    vi.stubEnv("BACKTEST_CACHE_DIR", "custom-cache");

    expect(getBacktestCacheRoot()).toBe(resolve(process.cwd(), "custom-cache"));
  });

  it("returns absolute configured path unchanged", () => {
    const absolutePath =
      process.platform === "win32"
        ? "C:\\cache\\backtest"
        : "/var/cache/backtest";
    vi.stubEnv("BACKTEST_CACHE_DIR", absolutePath);

    expect(getBacktestCacheRoot()).toBe(absolutePath);
  });
});
