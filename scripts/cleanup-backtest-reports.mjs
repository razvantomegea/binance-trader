#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCleanupCliArgs, selectByMaxAge } from "./cleanup-cli-shared.mjs";

const REPORT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "backtest-results",
);
const REPORT_PATTERN = /^backtest-\d+\.json$/;

async function listReports() {
  let entries;
  try {
    entries = await readdir(REPORT_DIR);
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

  const reports = [];

  for (const name of entries) {
    if (!REPORT_PATTERN.test(name)) {
      continue;
    }

    const path = join(REPORT_DIR, name);
    const fileStat = await stat(path);
    reports.push({ name, path, mtimeMs: fileStat.mtimeMs });
  }

  return reports.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function main() {
  const { dryRun, keep, maxAgeDays } = parseCleanupCliArgs(
    process.argv.slice(2),
    `Usage: pnpm backtest:cleanup [--dry-run] [--keep=N] [--max-age-days=N]

Deletes backtest report JSON files from backtest-results/.
Default: remove all reports.
Use --max-age-days=N to delete only files older than N days.
Use --keep=N to keep the N newest matched files.`,
  );
  const reports = await listReports();

  if (reports.length === 0) {
    console.log("No backtest reports to clean up.");
    return;
  }

  const candidates = selectByMaxAge(reports, maxAgeDays);
  if (candidates.length === 0) {
    console.log("No report files matched cleanup criteria.");
    return;
  }

  const toDelete = keep > 0 ? candidates.slice(keep) : candidates;

  if (toDelete.length === 0) {
    console.log(`Keeping all ${candidates.length} matched report(s). Nothing to delete.`);
    return;
  }

  for (const report of toDelete) {
    const action = dryRun ? "Would delete" : "Deleted";
    console.log(`${action}: ${report.path}`);
    if (!dryRun) {
      await rm(report.path, { force: true });
    }
  }

  const kept = candidates.length - toDelete.length;
  console.log(
    dryRun
      ? `Dry run complete. ${toDelete.length} file(s) would be deleted${kept > 0 ? `, ${kept} kept` : ""}.`
      : `Cleanup complete. ${toDelete.length} file(s) deleted${kept > 0 ? `, ${kept} kept` : ""}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
