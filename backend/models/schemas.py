"""
AspectIQ 2.0 — Pydantic API Request & Response Schemas
Mirrors the TypeScript contracts used by the Vite/React frontend.
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


OverallSentiment = Literal["Positive", "Negative", "Neutral", "Mixed"]
AspectSentiment = Literal["Positive", "Negative", "Neutral"]
SarcasmStatus = Literal["Detected", "Uncertain", "Not Detected"]
UncertaintyLevel = Literal["Low", "Moderate", "High"]


class AnalyzeStatementRequest(BaseModel):
    text: str = Field(..., min_length=2, max_length=4000)


class ExplorerSpanSchema(BaseModel):
    id: str
    phrase: str
    category: str
    classification: str
    associatedAspect: Optional[str] = None
    explanation: str
    attributionSource: Literal["Verified Span Match", "Model Attribution"]
    startOffset: int
    endOffset: int


class AspectSchema(BaseModel):
    id: str
    aspectTerm: Optional[str] = None
    aspectCategory: str
    isImplicit: bool
    opinionExpression: str
    sentiment: AspectSentiment
    startOffset: int = 0
    endOffset: int = 0


class LanguageAnalysisSchema(BaseModel):
    detectedLanguage: str
    sarcasmOrIrony: SarcasmStatus
    sarcasmNote: Optional[str] = None
    containsNegation: bool
    containsDoubleNegative: bool = False
    negationNote: Optional[str] = None
    figurativeOrImplicitNote: Optional[str] = None
    confidenceScore: Optional[float] = None
    confidenceStatus: str = "Confidence not calibrated (API LLM)"


class InsightsSchema(BaseModel):
    interpretation: str
    positiveExpressions: List[str] = Field(default_factory=list)
    negativeExpressions: List[str] = Field(default_factory=list)
    ambiguityNote: Optional[str] = None


class StatementAnalysisOutputSchema(BaseModel):
    analysisId: Optional[str] = None
    statementId: str
    speaker: Optional[str] = None
    timestamp: Optional[str] = None
    originalText: str
    overallSentiment: OverallSentiment
    uncertaintyLevel: UncertaintyLevel = "Low"
    uncertaintyReason: Optional[str] = None
    explanation: str
    commentTypes: List[str]
    tone: str
    emotion: str
    primaryEmotion: Optional[str] = None
    communicationIntent: str
    aspects: List[AspectSchema] = Field(default_factory=list)
    highlightedSpans: List[ExplorerSpanSchema] = Field(default_factory=list)
    languageAnalysis: LanguageAnalysisSchema
    insights: InsightsSchema


class BatchRowInput(BaseModel):
    statementId: str
    text: str = Field(..., min_length=2, max_length=4000)
    speaker: Optional[str] = None
    timestamp: Optional[str] = None


class BatchAnalyzeRequest(BaseModel):
    datasetName: str = "Statement Batch"
    inputMethod: Literal["csv_upload", "manual_batch"] = "manual_batch"
    rows: List[BatchRowInput] = Field(..., min_length=1, max_length=500)


class ConversationMessageInputSchema(BaseModel):
    messageId: str
    speaker: Optional[str] = None
    timestamp: Optional[str] = None
    text: str = Field(..., min_length=2, max_length=4000)


class ConversationAnalyzeRequest(BaseModel):
    title: str = "Conversation"
    messages: List[ConversationMessageInputSchema] = Field(..., min_length=2, max_length=120)


class FeedbackRequest(BaseModel):
    analysisId: str
    inputText: str
    predictedSentiment: str
    isCorrect: bool
    reportedIssue: Optional[str] = None
    notes: Optional[str] = None
