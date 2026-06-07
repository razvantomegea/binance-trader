/**
 * @vitest-environment node
 */
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

const {
  mockSetBackend,
  mockReady,
  mockLoadLayersModel,
  mockWithSaveHandler,
  mockFromMemory,
} = vi.hoisted(() => ({
  mockSetBackend: vi.fn(),
  mockReady: vi.fn(),
  mockLoadLayersModel: vi.fn(),
  mockWithSaveHandler: vi.fn(),
  mockFromMemory: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
}));

vi.mock("@tensorflow/tfjs", () => ({
  setBackend: mockSetBackend,
  ready: mockReady,
  loadLayersModel: mockLoadLayersModel,
  io: {
    withSaveHandler: mockWithSaveHandler,
    fromMemory: mockFromMemory,
  },
}));

import {
  ensureTfCpuBackend,
  loadModelFromDir,
  saveModelToDir,
} from "./model-io";

function setupModelIoSuite(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetBackend.mockResolvedValue(undefined);
    mockReady.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockLoadLayersModel.mockResolvedValue({ dispose: vi.fn() });
    mockFromMemory.mockReturnValue("memory://model");
    mockWithSaveHandler.mockImplementation(
      (
        handler: (artifacts: {
          modelTopology: object;
          weightSpecs?: unknown[];
          weightData?: ArrayBuffer | ArrayBuffer[];
          format?: string;
          generatedBy?: string;
          convertedBy?: string;
        }) => Promise<unknown>,
      ) => ({
        save: async () => {
          await handler({
            modelTopology: { class_name: "Sequential" },
            weightSpecs: [{ name: "w", shape: [1], dtype: "float32" }],
            weightData: new ArrayBuffer(8),
            format: "layers-model",
            generatedBy: "vitest",
            convertedBy: "vitest",
          });
        },
      }),
    );
  });
}

describe("model-io backend and basic io", () => {
  setupModelIoSuite();

  it("ensures CPU backend", async () => {
    await ensureTfCpuBackend();

    expect(mockSetBackend).toHaveBeenCalledWith("cpu");
    expect(mockReady).toHaveBeenCalled();
  });

  it("saves model artifacts to directory", async () => {
    const model = {
      save: vi
        .fn()
        .mockImplementation(async (handler: { save: () => Promise<void> }) => {
          await handler.save();
        }),
    };

    await saveModelToDir(model as never, "/models/run-1");

    expect(mockWriteFile).toHaveBeenCalledWith(
      join("/models/run-1", "model.json"),
      expect.any(String),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      join("/models/run-1", "weights.bin"),
      expect.any(Buffer),
    );
  });

  it("loads model without weights when manifest is empty", async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        modelTopology: { class_name: "Sequential" },
        weightsManifest: [{ weights: [] }],
      }),
    );

    await loadModelFromDir("/models/run-1");

    expect(mockFromMemory).toHaveBeenCalled();
    expect(mockLoadLayersModel).toHaveBeenCalledWith("memory://model");
  });

  it("loads model with weights buffer", async () => {
    mockReadFile
      .mockResolvedValueOnce(
        JSON.stringify({
          modelTopology: { class_name: "Sequential" },
          weightsManifest: [
            { weights: [{ name: "w", shape: [1], dtype: "float32" }] },
          ],
        }),
      )
      .mockResolvedValueOnce(Buffer.from([1, 2, 3, 4]));

    await loadModelFromDir("/models/run-1");

    expect(mockLoadLayersModel).toHaveBeenCalled();
  });

  it("falls back to topology-only load when weights file is missing", async () => {
    mockReadFile
      .mockResolvedValueOnce(
        JSON.stringify({
          modelTopology: { class_name: "Sequential" },
          weightsManifest: [
            { weights: [{ name: "w", shape: [1], dtype: "float32" }] },
          ],
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("missing"), { code: "ENOENT" }),
      );

    await loadModelFromDir("/models/run-1");

    expect(mockLoadLayersModel).toHaveBeenCalled();
  });
});

describe("model-io save path edge cases", () => {
  setupModelIoSuite();

  it("saves model when weight specs are omitted", async () => {
    mockWithSaveHandler.mockImplementationOnce(
      (
        handler: (artifacts: {
          modelTopology: object;
          weightSpecs?: unknown[];
          weightData?: ArrayBuffer;
        }) => Promise<unknown>,
      ) => ({
        save: async () => {
          await handler({
            modelTopology: { class_name: "Sequential" },
            weightData: new ArrayBuffer(4),
          });
        },
      }),
    );

    const model = {
      save: vi
        .fn()
        .mockImplementation(async (handler: { save: () => Promise<void> }) => {
          await handler.save();
        }),
    };

    await saveModelToDir(model as never, "/models/no-specs");

    expect(mockWriteFile).toHaveBeenCalledWith(
      join("/models/no-specs", "model.json"),
      expect.stringContaining('"weights":[]'),
    );
  });

  it("saves model without weight data and with chunked buffers", async () => {
    mockWithSaveHandler.mockImplementationOnce(
      (
        handler: (artifacts: {
          modelTopology: object;
          weightSpecs?: unknown[];
          weightData?: ArrayBuffer | ArrayBuffer[];
        }) => Promise<unknown>,
      ) => ({
        save: async () => {
          await handler({
            modelTopology: { class_name: "Sequential" },
            weightSpecs: [],
          });
        },
      }),
    );

    const modelWithoutWeights = {
      save: vi
        .fn()
        .mockImplementation(async (handler: { save: () => Promise<void> }) => {
          await handler.save();
        }),
    };

    await saveModelToDir(modelWithoutWeights as never, "/models/no-weights");

    expect(mockWriteFile).toHaveBeenCalledTimes(1);

    mockWithSaveHandler.mockImplementationOnce(
      (
        handler: (artifacts: {
          modelTopology: object;
          weightSpecs?: unknown[];
          weightData?: ArrayBuffer | ArrayBuffer[];
        }) => Promise<unknown>,
      ) => ({
        save: async () => {
          await handler({
            modelTopology: { class_name: "Sequential" },
            weightSpecs: [{ name: "w", shape: [2], dtype: "float32" }],
            weightData: [new ArrayBuffer(4), new ArrayBuffer(4)],
          });
        },
      }),
    );

    const modelWithChunks = {
      save: vi
        .fn()
        .mockImplementation(async (handler: { save: () => Promise<void> }) => {
          await handler.save();
        }),
    };

    await saveModelToDir(modelWithChunks as never, "/models/chunked");

    expect(mockWriteFile).toHaveBeenCalledWith(
      join("/models/chunked", "weights.bin"),
      expect.any(Buffer),
    );
  });
});

describe("model-io load path edge cases", () => {
  setupModelIoSuite();

  it("loads model when weights manifest is missing", async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        modelTopology: { class_name: "Sequential" },
      }),
    );

    await loadModelFromDir("/models/no-manifest");

    expect(mockLoadLayersModel).toHaveBeenCalled();
  });

  it("loads model when weights manifest entries omit weights arrays", async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({
        modelTopology: { class_name: "Sequential" },
        weightsManifest: [{ weights: null }],
      }),
    );

    await loadModelFromDir("/models/run-2");

    expect(mockLoadLayersModel).toHaveBeenCalled();
  });

  it("rethrows non-ENOENT errors while reading weights", async () => {
    mockReadFile
      .mockResolvedValueOnce(
        JSON.stringify({
          modelTopology: { class_name: "Sequential" },
          weightsManifest: [
            { weights: [{ name: "w", shape: [1], dtype: "float32" }] },
          ],
        }),
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("permission denied"), { code: "EACCES" }),
      );

    await expect(loadModelFromDir("/models/run-3")).rejects.toThrow(
      "permission denied",
    );
  });
});
