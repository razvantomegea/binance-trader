import * as tf from "@tensorflow/tfjs";

import {
  ML_DEFAULT_BATCH_SIZE,
  ML_DEFAULT_EPOCHS,
  ML_DEFAULT_LEARNING_RATE,
  ML_FORWARD_DRAWDOWN_CAP_PCT,
  ML_FORWARD_HORIZON_HOURS,
} from "@/constants/ml-strategy";
import type { MlDecisionRow, MlModelMetadata } from "@/types/ml-strategy";
import {
  fitFeatureNormalization,
  normalizeFeatures,
  splitRowsByTime,
} from "@/utils/ml/split-dataset-by-time";
import {
  getMlModelDir,
  getMlModelMetadataPath,
} from "@/utils/ml/ml-artifact-paths";
import { loadModelFromDir, saveModelToDir } from "@/utils/ml/model-io";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export interface TrainLogisticModelParams {
  rows: MlDecisionRow[];
  runId: string;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
}

export interface TrainLogisticModelResult {
  metadata: MlModelMetadata;
  modelDir: string;
}

function buildModel(params: {
  inputSize: number;
  learningRate: number;
}): tf.Sequential {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      inputShape: [params.inputSize],
      units: 1,
      activation: "sigmoid",
    }),
  );
  model.compile({
    optimizer: tf.train.adam(params.learningRate),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}

function computeClassWeight(
  train: MlDecisionRow[],
): Record<number, number> | undefined {
  const pos = train.filter((row) => row.label === 1).length;
  const neg = train.length - pos;
  if (pos === 0 || neg === 0) {
    return undefined;
  }
  return {
    0: train.length / (2 * neg),
    1: train.length / (2 * pos),
  };
}

function toNormalizedTensor(
  rows: MlDecisionRow[],
  normalization: ReturnType<typeof fitFeatureNormalization>,
): { xs: tf.Tensor2D; ys: tf.Tensor2D } {
  const xs = rows.map((row) => normalizeFeatures(row.features, normalization));
  const ys = rows.map((row) => row.label);
  return {
    xs: tf.tensor2d(xs),
    ys: tf.tensor2d(ys, [ys.length, 1]),
  };
}

function buildValidationTensors(params: {
  validationRows: MlDecisionRow[];
  normalization: ReturnType<typeof fitFeatureNormalization>;
}) {
  if (params.validationRows.length === 0) {
    return null;
  }
  return toNormalizedTensor(params.validationRows, params.normalization);
}

async function persistModelArtifacts(params: {
  runId: string;
  model: tf.Sequential;
  metadata: MlModelMetadata;
}): Promise<string> {
  const modelDir = getMlModelDir(params.runId);
  await mkdir(modelDir, { recursive: true });
  await saveModelToDir(params.model, modelDir);
  await writeFile(
    getMlModelMetadataPath(params.runId),
    JSON.stringify(params.metadata, null, 2),
    "utf8",
  );
  return modelDir;
}

function disposeTrainTensors(params: {
  train: { xs: tf.Tensor2D; ys: tf.Tensor2D };
  validation: { xs: tf.Tensor2D; ys: tf.Tensor2D } | null;
}) {
  params.train.xs.dispose();
  params.train.ys.dispose();
  params.validation?.xs.dispose();
  params.validation?.ys.dispose();
}

export async function trainLogisticModel(
  params: TrainLogisticModelParams,
): Promise<TrainLogisticModelResult> {
  const epochs = params.epochs ?? ML_DEFAULT_EPOCHS;
  const batchSize = params.batchSize ?? ML_DEFAULT_BATCH_SIZE;
  const learningRate = params.learningRate ?? ML_DEFAULT_LEARNING_RATE;

  const { train, validation } = splitRowsByTime(params.rows);
  if (train.length === 0) {
    throw new Error("Training dataset is empty.");
  }

  const normalization = fitFeatureNormalization(train);
  const model = buildModel({
    inputSize: normalization.featureNames.length,
    learningRate,
  });
  const classWeight = computeClassWeight(train);

  const trainTensors = toNormalizedTensor(train, normalization);
  const validationTensors = buildValidationTensors({
    validationRows: validation,
    normalization,
  });

  await model.fit(trainTensors.xs, trainTensors.ys, {
    epochs,
    batchSize,
    classWeight,
    validationData: validationTensors
      ? [validationTensors.xs, validationTensors.ys]
      : undefined,
    verbose: 0,
  });

  const metadata: MlModelMetadata = {
    runId: params.runId,
    createdAtIso: new Date().toISOString(),
    normalization,
    horizonHours: ML_FORWARD_HORIZON_HOURS,
    forwardDrawdownCapPct: ML_FORWARD_DRAWDOWN_CAP_PCT,
    epochs,
    trainRowCount: train.length,
    validationRowCount: validation.length,
  };

  const modelDir = await persistModelArtifacts({
    runId: params.runId,
    model,
    metadata,
  });
  disposeTrainTensors({ train: trainTensors, validation: validationTensors });
  model.dispose();

  return { metadata, modelDir };
}

export async function loadTrainedModel(params: {
  runId: string;
}): Promise<{ model: tf.LayersModel; metadata: MlModelMetadata }> {
  const metadataRaw = await readFile(
    getMlModelMetadataPath(params.runId),
    "utf8",
  );
  const metadata = JSON.parse(metadataRaw) as MlModelMetadata;
  const model = await loadModelFromDir(getMlModelDir(params.runId));
  return { model, metadata };
}
