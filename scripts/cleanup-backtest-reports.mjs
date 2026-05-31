#!/usr/bin/env node

import { readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPORT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "backtest-results",
);
const REPORT_PATTERN = /^backtest-\d+\.json$/;

function parseArgs(argv) {
  let dryRun = false;
  let keep = 0;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg.startsWith("--keep=")) {
      keep = Number(arg.slice("--keep=".length));
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: pnpm backtest:cleanup [--dry-run] [--keep=N]

Deletes backtest report JSON files from backtest-results/.
Default: remove all reports. Use --keep=N to keep the N newest files.`);
      process.exit(0);
    }
  }

  if (!Number.isInteger(keep) || keep < 0) {
    console.error("--keep must be a non-negative integer");
    process.exit(1);
  }

  return { dryRun, keep };
}

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
  const { dryRun, keep } = parseArgs(process.argv.slice(2));
  const reports = await listReports();

  if (reports.length === 0) {
    console.log("No backtest reports to clean up.");
    return;
  }

  const toDelete = keep > 0 ? reports.slice(keep) : reports;

  if (toDelete.length === 0) {
    console.log(`Keeping all ${reports.length} report(s). Nothing to delete.`);
    return;
  }

  for (const report of toDelete) {
    const action = dryRun ? "Would delete" : "Deleted";
    console.log(`${action}: ${report.path}`);
    if (!dryRun) {
      await rm(report.path, { force: true });
    }
  }

  const kept = reports.length - toDelete.length;
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
