import { isAbsolute, resolve } from "node:path";

const DEFAULT_CACHE_DIR = "backtest-cache";

function resolveCacheRootPath(path: string): string {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

export function getBacktestCacheRoot(): string {
  return resolveCacheRootPath(
    process.env.BACKTEST_CACHE_DIR?.trim() ?? DEFAULT_CACHE_DIR,
  );
}
