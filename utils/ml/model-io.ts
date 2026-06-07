import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import * as tf from "@tensorflow/tfjs";

const MODEL_JSON = "model.json";
const WEIGHTS_BIN = "weights.bin";

interface SavedModelJson {
  modelTopology: object;
  weightsManifest: Array<{ weights: tf.io.WeightsManifestEntry[] }>;
  format?: string;
  generatedBy?: string;
  convertedBy?: string;
}

function arrayBufferToBuffer(arrayBuffer: ArrayBuffer): Buffer {
  return Buffer.from(new Uint8Array(arrayBuffer));
}

function weightDataToBuffer(weightData: tf.io.WeightData): Buffer {
  if (weightData instanceof ArrayBuffer) {
    return arrayBufferToBuffer(weightData);
  }

  return Buffer.concat(weightData.map((part) => arrayBufferToBuffer(part)));
}

export async function ensureTfCpuBackend(): Promise<void> {
  await tf.setBackend("cpu");
  await tf.ready();
}

export async function saveModelToDir(
  model: tf.LayersModel,
  dir: string,
): Promise<void> {
  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const weightsManifest = [
        {
          paths: [WEIGHTS_BIN],
          weights: artifacts.weightSpecs ?? [],
        },
      ];

      await writeFile(
        join(dir, MODEL_JSON),
        JSON.stringify({
          modelTopology: artifacts.modelTopology,
          weightsManifest,
          format: artifacts.format,
          generatedBy: artifacts.generatedBy,
          convertedBy: artifacts.convertedBy,
        }),
      );

      if (artifacts.weightData) {
        await writeFile(
          join(dir, WEIGHTS_BIN),
          weightDataToBuffer(artifacts.weightData),
        );
      }

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: "JSON",
        },
      };
    }),
  );
}

export async function loadModelFromDir(dir: string): Promise<tf.LayersModel> {
  const modelJsonPath = join(dir, MODEL_JSON);
  const weightsPath = join(dir, WEIGHTS_BIN);

  const modelJson = JSON.parse(
    await readFile(modelJsonPath, "utf8"),
  ) as SavedModelJson;

  const weightSpecs = modelJson.weightsManifest[0]?.weights ?? [];
  const weightsBuffer = await readFile(weightsPath);

  return tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology,
      weightSpecs,
      weightData: weightsBuffer.buffer.slice(
        weightsBuffer.byteOffset,
        weightsBuffer.byteOffset + weightsBuffer.byteLength,
      ),
      format: modelJson.format,
      generatedBy: modelJson.generatedBy,
      convertedBy: modelJson.convertedBy,
    }),
  );
}
