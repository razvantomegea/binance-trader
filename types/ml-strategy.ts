import type { StrategyParams } from "@/types/strategy-params";

export type MlHorizonHours = 24 | 48 | 72;

export interface MlLabelMeta {
  forwardReturnPct: number;
  forwardMaxDrawdownPct: number;
  horizonHours: MlHorizonHours;
}

export interface MlDecisionRow {
  symbol: string;
  openTime: number;
  featureNames: string[];
  features: number[];
  label: 0 | 1;
  labelMeta: MlLabelMeta;
}

export interface MlFeatureNormalization {
  featureNames: string[];
  means: number[];
  stds: number[];
}

export interface MlModelMetadata {
  runId: string;
  createdAtIso: string;
  normalization: MlFeatureNormalization;
  horizonHours: MlHorizonHours;
  forwardDrawdownCapPct: number;
  epochs: number;
  trainRowCount: number;
  validationRowCount: number;
}

export interface MlRiskAdjustedMetrics {
  pnlPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  totalTrades: number;
  riskAdjustedScore: number;
}

export interface MlOptimizationCandidate {
  strategyParams: StrategyParams;
  modelMinProbability: number | null;
  metrics: MlRiskAdjustedMetrics;
  split: "train" | "validation" | "test";
}

export interface MlOptimizationRun {
  runId: string;
  createdAtIso: string;
  candidates: MlOptimizationCandidate[];
  bestValidation: MlOptimizationCandidate | null;
  bestTest: MlOptimizationCandidate | null;
}

export interface MlTimeSplit {
  trainEndOpenTime: number;
  validationEndOpenTime: number;
}
