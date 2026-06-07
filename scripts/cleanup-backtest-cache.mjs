#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseCleanupCliArgs, selectByMaxAge } from "./cleanup-cli-shared.mjs";

const DEFAULT_CACHE_DIR = "backtest-cache";

function getBacktestCacheRoot() {
  const configured = process.env.BACKTEST_CACHE_DIR?.trim();

  if (!configured || configured === DEFAULT_CACHE_DIR) {
    return join(process.cwd(), DEFAULT_CACHE_DIR);
  }

  if (isAbsolute(configured)) {
    return configured;
  }

  return resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

const CACHE_DIR = join(getBacktestCacheRoot(), "binance-klines");
const CACHE_PATTERN = /^[A-Z0-9_-]+-[A-Z0-9_-]+-\d{4}-\d{2}-\d{2}-\d+\.json$/i;

async function listCacheFiles() {
  let entries;
  try {
    entries = await readdir(CACHE_DIR);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const name of entries) {
    if (!CACHE_PATTERN.test(name)) {
      continue;
    }

    const path = join(CACHE_DIR, name);
    const fileStat = await stat(path);
    files.push({ name, path, mtimeMs: fileStat.mtimeMs });
  }

  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function main() {
  const { dryRun, keep, maxAgeDays } = parseCleanupCliArgs(
    process.argv.slice(2),
    `Usage: pnpm backtest:cache:cleanup [--dry-run] [--keep=N] [--max-age-days=N]

Deletes local Binance cache files from backtest-cache/binance-klines/.
Default: remove all cache files.
Use --max-age-days=N to delete only files older than N days.
Use --keep=N to keep the N newest files among deletion candidates.`,
  );
  const cacheFiles = await listCacheFiles();

  if (cacheFiles.length === 0) {
    console.log("No backtest cache files to clean up.");
    return;
  }

  const candidates = selectByMaxAge(cacheFiles, maxAgeDays);
  if (candidates.length === 0) {
    console.log("No cache files matched cleanup criteria.");
    return;
  }

  const toDelete = keep > 0 ? candidates.slice(keep) : candidates;
  if (toDelete.length === 0) {
    console.log(
      `Keeping all ${candidates.length} matched cache file(s). Nothing to delete.`,
    );
    return;
  }

  for (const file of toDelete) {
    const action = dryRun ? "Would delete" : "Deleted";
    console.log(`${action}: ${file.path}`);
    if (!dryRun) {
      await rm(file.path, { force: true });
    }
  }

  const kept = candidates.length - toDelete.length;
  console.log(
    dryRun
      ? `Dry run complete. ${toDelete.length} cache file(s) would be deleted${kept > 0 ? `, ${kept} kept` : ""}.`
      : `Cleanup complete. ${toDelete.length} cache file(s) deleted${kept > 0 ? `, ${kept} kept` : ""}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
