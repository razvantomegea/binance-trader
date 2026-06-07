#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") {
  console.error("ML scripts are localhost-only and cannot run in production.");
  process.exit(1);
}

const scriptName = process.argv[2];
const scriptArgs = process.argv.slice(3);

/** @type {Record<string, string>} */
const scripts = {
  dataset: "generate-ml-backtest-dataset.ts",
  train: "train-ml-strategy.ts",
  eval: "evaluate-ml-strategy.ts",
  optimize: "optimize-strategy-params.ts",
};

const target = scripts[scriptName ?? ""];
if (!target) {
  console.error(
    "Usage: node scripts/run-ml.mjs <dataset|train|eval|optimize> [args...]",
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const runnerPath = join(__dirname, target);

const result = spawnSync("pnpm", ["exec", "tsx", runnerPath, ...scriptArgs], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
