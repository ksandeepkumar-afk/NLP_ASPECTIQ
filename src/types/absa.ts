/**
 * Core domain types for AspectIQ — Aspect-Based Sentiment Intelligence System.
 * Strictly decouples ML/DL model prediction outputs from Gemini-generated
 * natural language explanations and distinguishes sample preview data from
 * live model evaluations.
 */

export enum SentimentPolarity {
  Positive = 'Positive',
  Negative = 'Negative',
  Neutral = 'Neutral',
}

export enum ReviewDomain {
  Electronics = 'Electronics',
  Restaurants = 'Restaurants',
}

export enum PredictionSource {
  SamplePreview = 'SamplePreview',
  TrainedModel = 'TrainedModel',
}

export enum EvaluationState {
  AwaitingTraining = 'AwaitingTraining',
  Evaluating = 'Evaluating',
  Evaluated = 'Evaluated',
}

export enum DashboardSection {
  Overview = 'overview',
  Workbench = 'workbench',
  CsvIngestion = 'ingestion',
  Benchmarks = 'benchmarks',
  Architecture = 'architecture',
}

export interface AspectSpanPrediction {
  id: string;
  aspectTerm: string;
  aspectCategory: string;
  polarity: SentimentPolarity;
  startOffset: number;
  endOffset: number;
  /** Model probability score (0–1). Only populated by real model inference or clearly marked sample preview. */
  confidenceScore: number | null;
}

export interface ModelPredictionPayload {
  source: PredictionSource;
  modelIdentifier: string;
  aspects: AspectSpanPrediction[];
  inferenceLatencyMs: number | null;
}

export interface GeminiExplanationPayload {
  source: 'GeminiExplanationLayer';
  status: 'not_connected' | 'idle' | 'ready' | 'error';
  summary: string | null;
  rationaleByAspect: Array<{
    aspectTerm: string;
    reasoning: string;
  }>;
  disclaimer: string;
}

export interface SampleReviewRecord {
  id: string;
  domain: ReviewDomain;
  productOrVenue: string;
  reviewText: string;
  createdAt: string;
  isSampleData: true;
  prediction: ModelPredictionPayload;
  explanation: GeminiExplanationPayload;
}

export interface AspectAggregateRow {
  aspectCategory: string;
  domain: ReviewDomain;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalMentions: number;
}

export interface ModelArchitectureSpec {
  id: string;
  name: string;
  family: 'Classical ML' | 'Deep Learning' | 'Transformer';
  datasetTrack: 'SemEval-2014 Task 4 (Laptops & Restaurants)';
  inputRepresentation: string;
  purpose: string;
  evaluationState: EvaluationState;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
  } | null;
}

export interface ParsedCsvRow {
  rowNumber: number;
  reviewId: string;
  domain: string;
  reviewText: string;
  isValid: boolean;
  validationError: string | null;
}

export interface CsvValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  detectedColumns: string[];
  rows: ParsedCsvRow[];
  fatalError: string | null;
}

export interface ArchitectureComponentDoc {
  id: string;
  title: string;
  layer: string;
  modulePath: string;
  implementationStatus: 'Implemented (Sample Preview)' | 'Interface Ready (Phase 2)';
  purpose: string;
  inputs: string;
  outputs: string;
}
