import { isAbsolute, join, resolve } from "node:path";

const DEFAULT_CACHE_DIR = "backtest-cache";

export function getBacktestCacheRoot(): string {
  const configured = process.env.BACKTEST_CACHE_DIR?.trim();

  if (!configured || configured === DEFAULT_CACHE_DIR) {
    return join(process.cwd(), DEFAULT_CACHE_DIR);
  }

  if (isAbsolute(configured)) {
    return configured;
  }

  return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}
