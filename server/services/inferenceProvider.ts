/**
 * AspectIQ 2.0 — Core Inference & NLP Domain Contracts
 * Decouples statement, aspect, conversation, and semantic NLP inference from
 * HTTP routes and persistence layers so locally trained models can be plugged in.
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

export interface BatchStatementInput {
  statementId: string;
  text: string;
  speaker?: string | null;
  timestamp?: string | null;
}

export interface BatchRowError {
  statementId: string;
  text: string;
  error: string;
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

export interface StatementInferenceProvider {
  readonly providerName: string;
  readonly isApiBased: boolean;
  isAvailable(): boolean;
  analyzeStatement(statementId: string, text: string): Promise<StatementAnalysisOutput>;
  analyzeBatch(inputs: BatchStatementInput[]): Promise<StatementAnalysisOutput[]>;
}
