#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { assertLocalhostOnly } from "@/helpers/strategy/backtest/assert-localhost-only";
import { trainLogisticModel } from "@/helpers/ml/train-logistic-model";
import type { MlDecisionRow } from "@/types/ml-strategy";
import { getMlDatasetsDir } from "@/utils/ml/ml-artifact-paths";
import { readJsonl } from "@/utils/ml/read-write-jsonl";
import { ensureTfCpuBackend } from "@/utils/ml/model-io";
import { ML_DEFAULT_EPOCHS } from "@/constants/ml-strategy";
import { parseCliNumber } from "./ml/parse-ml-cli-args";

interface CliOptions {
  dataset?: string;
  runId?: string;
  epochs: number;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { epochs: ML_DEFAULT_EPOCHS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--dataset" && next) {
      options.dataset = next;
      i += 1;
    } else if (arg === "--run-id" && next) {
      options.runId = next;
      i += 1;
    } else if (arg === "--epochs" && next) {
      options.epochs = parseCliNumber({
        flag: "--epochs",
        value: next,
        integer: true,
        min: 1,
      });
      i += 1;
    }
  }

  return options;
}

async function resolveLatestDataset(): Promise<string> {
  const dir = getMlDatasetsDir();
  const files = (await readdir(dir))
    .filter((name) => name.endsWith(".jsonl"))
    .sort();

  const latest = files[files.length - 1];
  if (!latest) {
    throw new Error(`No dataset found in ${dir}. Run pnpm ml:dataset first.`);
  }

  return join(dir, latest);
}

async function main(): Promise<void> {
  assertLocalhostOnly();
  await ensureTfCpuBackend();
  const options = parseArgs(process.argv.slice(2));
  const datasetPath = options.dataset ?? (await resolveLatestDataset());
  const runId = options.runId ?? `model-${Date.now()}`;

  console.log(`Training model from ${datasetPath}`);
  const rows = await readJsonl<MlDecisionRow>(datasetPath);

  if (rows.length === 0) {
    throw new Error("Dataset is empty.");
  }

  const result = await trainLogisticModel({
    rows,
    runId,
    epochs: options.epochs,
  });

  console.log(`Model saved: ${result.modelDir}`);
  console.log(
    `Train rows=${result.metadata.trainRowCount}, validation rows=${result.metadata.validationRowCount}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
