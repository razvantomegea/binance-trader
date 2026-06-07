#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

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

function parseArgs(argv) {
  let dryRun = false;
  let keep = 0;
  let maxAgeDays = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--keep=")) {
      keep = Number(arg.slice("--keep=".length));
      continue;
    }

    if (arg.startsWith("--max-age-days=")) {
      maxAgeDays = Number(arg.slice("--max-age-days=".length));
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm backtest:cache:cleanup [--dry-run] [--keep=N] [--max-age-days=N]

Deletes local Binance cache files from backtest-cache/binance-klines/.
Default: remove all cache files.
Use --max-age-days=N to delete only files older than N days.
Use --keep=N to keep the N newest files among deletion candidates.`);
      process.exit(0);
    }
  }

  if (!Number.isInteger(keep) || keep < 0) {
    console.error("--keep must be a non-negative integer");
    process.exit(1);
  }

  if (maxAgeDays !== null && (!Number.isFinite(maxAgeDays) || maxAgeDays < 0)) {
    console.error("--max-age-days must be a non-negative number");
    process.exit(1);
  }

  return { dryRun, keep, maxAgeDays };
}

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

function selectDeletionCandidates(files, maxAgeDays) {
  if (maxAgeDays === null) {
    return files;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  return files.filter((file) => file.mtimeMs < cutoff);
}

async function main() {
  const { dryRun, keep, maxAgeDays } = parseArgs(process.argv.slice(2));
  const cacheFiles = await listCacheFiles();

  if (cacheFiles.length === 0) {
    console.log("No backtest cache files to clean up.");
    return;
  }

  const candidates = selectDeletionCandidates(cacheFiles, maxAgeDays);
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
