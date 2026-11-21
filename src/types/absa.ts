/**
 * AspectIQ 2.0 — Core Frontend Domain Types
 * Covers Statement Analyzer, Interactive Word Explorer, Conversation Analyzer,
 * Batch Intelligence, Semantic Search & Topic Discovery, Analytics, History,
 * Explainable AI Feedback, and Model Comparison.
 */

export type OverallSentiment = 'Positive' | 'Negative' | 'Neutral' | 'Mixed';
export type AspectSentiment = 'Positive' | 'Negative' | 'Neutral';
export type SarcasmStatus = 'Detected' | 'Uncertain' | 'Not Detected';
export type UncertaintyLevel = 'Low' | 'Moderate' | 'High';

export type SpanHighlightCategory =
  | 'positive_expression'
  | 'negative_expression'
  | 'sarcastic_expression'
  | 'aspect'
  | 'negation'
  | 'emotional_expression';

export enum EvaluationState {
  AwaitingTraining = 'AwaitingTraining',
  Evaluating = 'Evaluating',
  Evaluated = 'Evaluated',
}

export enum DashboardSection {
  Workbench = 'workbench',
  BatchIngestion = 'batch',
  Conversation = 'conversation',
  Benchmarks = 'benchmarks',
  Analytics = 'analytics',
  History = 'history',
}

export interface ExplorerSpan {
  id: string;
  phrase: string;
  category: SpanHighlightCategory;
  classification: string;
  associatedAspect: string | null;
  explanation: string;
  attributionSource: 'Verified Span Match' | 'Model Attribution';
  startOffset: number;
  endOffset: number;
}

export interface AnalyzedAspectOutput {
  id: string;
  aspectTerm: string | null;
  aspectCategory: string;
  isImplicit: boolean;
  opinionExpression: string;
  sentiment: AspectSentiment;
  startOffset: number;
  endOffset: number;
}

export interface StatementAnalysisOutput {
  analysisId?: string;
  statementId: string;
  speaker?: string | null;
  timestamp?: string | null;
  originalText: string;
  overallSentiment: OverallSentiment;
  uncertaintyLevel: UncertaintyLevel;
  uncertaintyReason: string | null;
  explanation: string;
  commentTypes: string[];
  tone: string;
  emotion: string;
  primaryEmotion: string | null;
  communicationIntent: string;
  aspects: AnalyzedAspectOutput[];
  highlightedSpans: ExplorerSpan[];
  languageAnalysis: {
    detectedLanguage: string;
    sarcasmOrIrony: SarcasmStatus;
    sarcasmNote: string | null;
    containsNegation: boolean;
    containsDoubleNegative: boolean;
    negationNote: string | null;
    figurativeOrImplicitNote: string | null;
    confidenceScore: number | null;
    confidenceStatus: string;
  };
  insights: {
    interpretation: string;
    positiveExpressions: string[];
    negativeExpressions: string[];
    ambiguityNote: string | null;
  };
}

export interface SingleAnalyzeResponse {
  ok: boolean;
  analysisId?: string;
  providerName?: string;
  isApiBased?: boolean;
  processingTimeMs?: number;
  result?: StatementAnalysisOutput;
  errorCode?: string;
  errorMessage?: string;
}

export interface RawStatementInputRow {
  rowNumber: number;
  statementId: string;
  speaker: string | null;
  timestamp: string | null;
  text: string;
  isValid: boolean;
  isDuplicate: boolean;
  validationError: string | null;
}

export interface ParsedCsvDocument {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  rawRows: string[][];
  autoDetectedColumn: string | null;
  selectedColumn: string | null;
  idColumn: string | null;
  speakerColumn: string | null;
  timestampColumn: string | null;
  fatalError: string | null;
}

export interface CsvDatasetPreview {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  selectedColumn: string | null;
  speakerColumn: string | null;
  timestampColumn: string | null;
  autoDetected: boolean;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  rows: RawStatementInputRow[];
  fatalError: string | null;
}

export interface LabelCountEntry {
  label: string;
  count: number;
}

export interface AspectSummaryEntry {
  aspectCategory: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalMentions: number;
}

export interface BatchRowError {
  statementId: string;
  text: string;
  error: string;
}

export interface BatchAnalysisResult {
  ok: boolean;
  datasetId: string;
  datasetName: string;
  inputMethod: 'csv_upload' | 'manual_batch';
  providerName: string;
  isApiBased: boolean;
  analyzedAt: string;
  totalSubmitted: number;
  failedCount: number;
  failedRows: BatchRowError[];
  skippedCount: number;
  processingTimeMs: number;
  totalStatementsAnalyzed: number;
  totalAspectsExtracted: number;
  sentimentCounts: Record<OverallSentiment, number>;
  sarcasmDetectedCount: number;
  negationCount: number;
  commentTypeSummary: LabelCountEntry[];
  toneSummary: LabelCountEntry[];
  emotionSummary: LabelCountEntry[];
  intentSummary: LabelCountEntry[];
  aspectSummary: AspectSummaryEntry[];
  mostPositiveAspects: AspectSummaryEntry[];
  mostNegativeAspects: AspectSummaryEntry[];
  results: StatementAnalysisOutput[];
}

export interface ConversationMessageInput {
  messageId: string;
  speaker: string | null;
  timestamp: string | null;
  text: string;
}

export interface ConversationMessageAnalysis {
  messageId: string;
  index: number;
  speaker: string | null;
  timestamp: string | null;
  text: string;
  sentiment: OverallSentiment;
  sentimentTrendScore: number;
  commentTypes: string[];
  tone: string;
  emotion: string;
  communicationIntent: string;
  aspects: AnalyzedAspectOutput[];
  sarcasmOrIrony: SarcasmStatus;
  explanation: string;
}

export interface ConversationAnalysisResult {
  conversationId: string;
  title: string;
  analyzedAt: string;
  totalMessages: number;
  hasExplicitSpeakers: boolean;
  providerName: string;
  isApiBased: boolean;
  processingTimeMs: number;
  overallSummary: string;
  sentimentTrendSummary: string;
  emotionalToneShifts: string[];
  repeatedTopics: Array<{
    topic: string;
    mentionCount: number;
    dominantSentiment: OverallSentiment;
  }>;
  mainPositiveSubjects: string[];
  mainNegativeSubjects: string[];
  disagreementPoints: string[];
  disclaimer: string;
  messages: ConversationMessageAnalysis[];
}

export interface SemanticSearchMatch {
  statementId: string;
  text: string;
  overallSentiment: OverallSentiment;
  similarityScore: number;
}

export interface TopicClusterResult {
  clusterId: string;
  approximateLabel: string;
  statementCount: number;
  representativeExamples: Array<{
    statementId: string;
    text: string;
    overallSentiment: OverallSentiment;
  }>;
  sentimentDistribution: Record<OverallSentiment, number>;
  disclaimer: string;
}

export interface HistorySummaryRecord {
  id: string;
  createdAt: string;
  sourceType: 'statement' | 'batch' | 'conversation';
  inputPreview: string;
  overallSentiment: OverallSentiment;
  commentTypes: string[];
  mainAspects: string[];
  status: 'Completed' | 'Failed';
}

export interface PredictionFeedbackRecord {
  id: string;
  createdAt: string;
  analysisId: string;
  inputText: string;
  predictedSentiment: string;
  isCorrect: boolean;
  reportedIssue: string | null;
  notes: string | null;
}

export interface StoredEvaluationRecord {
  id: string;
  createdAt: string;
  modelId: string;
  modelName: string;
  datasetName: string;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  trainingTimeMs: number;
  inferenceTimeMs: number;
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  labels: string[];
  confusionMatrix: number[][];
  lossHistory: Array<{ epoch: number; trainLoss: number; valLoss: number }>;
  notes: string;
}

export interface StoredBatchSummary {
  batchId: string;
  createdAt: string;
  datasetName: string;
  inputMethod: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  payload: BatchAnalysisResult;
}

export interface ModelArchitectureSpec {
  id: string;
  name: string;
  family: 'Classical ML' | 'Deep Learning' | 'Transformer' | 'API LLM';
  datasetTrack: string;
  inputRepresentation: string;
  purpose: string;
  inferenceStatus:
    | 'Active Local Trainable'
    | 'Active Internal API Provider'
    | 'Requires Python PyTorch Runtime';
  evaluationState: EvaluationState;
}
