import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/backtest-cache-root", () => ({
  getBacktestCacheRoot: () => "/cache-root",
}));

import {
  getMlDatasetsDir,
  getMlModelDir,
  getMlModelMetadataPath,
  getMlModelsDir,
  getMlOptimizationRunPath,
  getMlRunsDir,
} from "./ml-artifact-paths";

describe("ml-artifact-paths", () => {
  it("builds ML cache paths under backtest cache root", () => {
    expect(getMlDatasetsDir()).toBe(join("/cache-root", "ml", "datasets"));
    expect(getMlModelsDir()).toBe(join("/cache-root", "ml", "models"));
    expect(getMlRunsDir()).toBe(join("/cache-root", "ml", "runs"));
  });

  it("builds run-specific model and metadata paths", () => {
    expect(getMlModelDir("run-1")).toBe(
      join("/cache-root", "ml", "models", "run-1"),
    );
    expect(getMlModelMetadataPath("run-1")).toBe(
      join("/cache-root", "ml", "models", "run-1", "metadata.json"),
    );
    expect(getMlOptimizationRunPath("run-1")).toBe(
      join("/cache-root", "ml", "runs", "run-1.json"),
    );
  });
});
