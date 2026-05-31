#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") {
  console.error("Backtest is localhost-only and cannot run in production.");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(__dirname, "run-backtest-runner.ts");

const result = spawnSync(
  "pnpm",
  ["exec", "tsx", runnerPath, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: process.env,
    shell: true,
  },
);

process.exit(result.status ?? 1);
