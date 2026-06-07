/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MlDecisionRow } from "@/types/ml-strategy";

const { mockMkdir, mockWriteFile, mockReadFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockReadFile: vi.fn(),
}));

const {
  mockSaveModelToDir,
  mockLoadModelFromDir,
  mockFit,
  mockDispose,
  mockSequential,
  mockDense,
  mockCompile,
  mockTensor2d,
  mockAdam,
} = vi.hoisted(() => ({
  mockSaveModelToDir: vi.fn(),
  mockLoadModelFromDir: vi.fn(),
  mockFit: vi.fn(),
  mockDispose: vi.fn(),
  mockSequential: vi.fn(),
  mockDense: vi.fn(),
  mockCompile: vi.fn(),
  mockTensor2d: vi.fn(),
  mockAdam: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mockMkdir,
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

vi.mock("@/utils/ml/model-io", () => ({
  saveModelToDir: mockSaveModelToDir,
  loadModelFromDir: mockLoadModelFromDir,
}));

vi.mock("@/utils/ml/ml-artifact-paths", () => ({
  getMlModelDir: (runId: string) => `/models/${runId}`,
  getMlModelMetadataPath: (runId: string) => `/models/${runId}/metadata.json`,
}));

vi.mock("@tensorflow/tfjs", () => ({
  sequential: mockSequential,
  layers: { dense: mockDense },
  train: { adam: mockAdam },
  tensor2d: mockTensor2d,
}));

import { loadTrainedModel, trainLogisticModel } from "./train-logistic-model";

function makeRow(openTime: number, label: 0 | 1): MlDecisionRow {
  return {
    symbol: "BTCUSDT",
    openTime,
    featureNames: ["f1", "f2"],
    features: label === 1 ? [2, 3] : [1, 1],
    label,
    labelMeta: {
      forwardReturnPct: 1,
      forwardMaxDrawdownPct: 0.5,
      horizonHours: 24,
    },
  };
}

describe("trainLogisticModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockSaveModelToDir.mockResolvedValue(undefined);
    mockAdam.mockReturnValue("adam");
    mockTensor2d.mockImplementation(() => ({
      dispose: vi.fn(),
    }));

    const model = {
      add: vi.fn(),
      compile: mockCompile,
      fit: mockFit.mockResolvedValue(undefined),
      dispose: mockDispose,
    };
    mockSequential.mockReturnValue(model);
    mockDense.mockReturnValue({});
  });

  it("throws when training dataset is empty", async () => {
    await expect(
      trainLogisticModel({ rows: [], runId: "run-1" }),
    ).rejects.toThrow(/Training dataset is empty/);
  });

  it("trains model and persists artifacts", async () => {
    const rows = [
      makeRow(1000, 1),
      makeRow(2000, 0),
      makeRow(3000, 1),
      makeRow(4000, 0),
      makeRow(5000, 1),
      makeRow(6000, 0),
    ];

    const result = await trainLogisticModel({
      rows,
      runId: "run-abc",
      epochs: 2,
      batchSize: 2,
      learningRate: 0.01,
    });

    expect(mockFit).toHaveBeenCalled();
    expect(mockSaveModelToDir).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalled();
    expect(result.metadata.runId).toBe("run-abc");
    expect(result.modelDir).toBe("/models/run-abc");
    expect(mockDispose).toHaveBeenCalled();
  });
});

describe("loadTrainedModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        runId: "run-1",
        createdAtIso: "2024-01-01T00:00:00.000Z",
        normalization: {
          featureNames: ["f1"],
          means: [0],
          stds: [1],
        },
        horizonHours: 24,
        forwardDrawdownCapPct: 5,
        epochs: 10,
        trainRowCount: 100,
        validationRowCount: 20,
      }),
    );
    mockLoadModelFromDir.mockResolvedValue({ dispose: vi.fn() });
  });

  it("loads metadata and model from disk", async () => {
    const loaded = await loadTrainedModel({ runId: "run-1" });

    expect(loaded.metadata.runId).toBe("run-1");
    expect(mockLoadModelFromDir).toHaveBeenCalledWith("/models/run-1");
  });
});
