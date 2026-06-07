import { join } from "node:path";

export function getMlCacheRoot(): string {
  return join(process.cwd(), "backtest-cache", "ml");
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
