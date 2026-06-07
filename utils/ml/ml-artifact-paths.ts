import { join } from "node:path";

import { getBacktestCacheRoot } from "@/utils/backtest-cache-root";

function getMlCacheRoot(): string {
  return join(getBacktestCacheRoot(), "ml");
}

export function getMlDatasetsDir(): string {
  return join(getMlCacheRoot(), "datasets");
}

export function getMlModelsDir(): string {
  return join(getMlCacheRoot(), "models");
}

export function getMlRunsDir(): string {
  return join(getMlCacheRoot(), "runs");
}

export function getMlModelDir(runId: string): string {
  return join(getMlModelsDir(), runId);
}

export function getMlModelMetadataPath(runId: string): string {
  return join(getMlModelDir(runId), "metadata.json");
}

export function getMlOptimizationRunPath(runId: string): string {
  return join(getMlRunsDir(), `${runId}.json`);
}
