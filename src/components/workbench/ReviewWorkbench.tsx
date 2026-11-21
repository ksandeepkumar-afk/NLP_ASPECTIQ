import { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Flag,
  Loader2,
  Play,
  RotateCcw,
  ThumbsUp,
} from 'lucide-react';
import { OPTIONAL_STATEMENT_EXAMPLES } from '../../data/sampleDataset';
import { validateSingleStatementInput } from '../../services/csvParser';
import { analyzeSingleStatement, submitPredictionFeedback } from '../../services/modelAdapter';
import { exportSingleStatementJson } from '../../services/reportExport';
import { DashboardSection, StatementAnalysisOutput } from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';
import { InteractiveWordExplorer } from './InteractiveWordExplorer';

interface ReviewWorkbenchProps {
  initialStatement?: StatementAnalysisOutput | null;
  draftText?: string;
  onDraftTextChange?: (text: string) => void;
  savedResult?: StatementAnalysisOutput | null;
  onSavedResultChange?: (result: StatementAnalysisOutput | null) => void;
  onNavigateSection: (section: DashboardSection) => void;
}

export function ReviewWorkbench({
  initialStatement,
  draftText,
  onDraftTextChange,
  savedResult,
  onSavedResultChange,
  onNavigateSection,
}: ReviewWorkbenchProps) {
  const [internalText, setInternalText] = useState(initialStatement?.originalText ?? '');
  const [internalResult, setInternalResult] = useState<StatementAnalysisOutput | null>(
    initialStatement ?? null
  );

  const statementText = draftText !== undefined ? draftText : internalText;
  const setStatementText = (val: string) => {
    if (onDraftTextChange) onDraftTextChange(val);
    else setInternalText(val);
  };

  const result = savedResult !== undefined ? savedResult : internalResult;
  const setResult = (val: StatementAnalysisOutput | null) => {
    if (onSavedResultChange) onSavedResultChange(val);
    else setInternalResult(val);
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processingTimeMs, setProcessingTimeMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Explainable AI Feedback state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  useEffect(() => {
    if (initialStatement) {
      if (onDraftTextChange) onDraftTextChange(initialStatement.originalText);
      else setInternalText(initialStatement.originalText);
      if (onSavedResultChange) onSavedResultChange(initialStatement);
      else setInternalResult(initialStatement);
      setErrorMessage(null);
      setFeedbackStatus(null);
      setFeedbackOpen(false);
    }
  }, [initialStatement, onDraftTextChange, onSavedResultChange]);

  const handleTextChange = (value: string) => {
    setStatementText(value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleClear = () => {
    setStatementText('');
    setResult(null);
    setErrorMessage(null);
    setProcessingTimeMs(null);
    setFeedbackStatus(null);
    setFeedbackOpen(false);
    setFeedbackNotes('');
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateSingleStatementInput(statementText);
    if (!validation.valid) {
      setErrorMessage(validation.error);
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setFeedbackStatus(null);
    setFeedbackOpen(false);

    try {
      const response = await analyzeSingleStatement(statementText.trim());
      if (!response.ok || !response.result) {
        setErrorMessage(response.errorMessage ?? 'Unable to analyze statement.');
        return;
      }

      setResult(response.result);
      setProcessingTimeMs(response.processingTimeMs ?? null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitFeedback = async (isCorrect: boolean) => {
    if (!result) return;
    setIsSubmittingFeedback(true);
    try {
      const resp = await submitPredictionFeedback({
        analysisId: result.analysisId ?? `ANL-LOCAL-${Date.now()}`,
        inputText: result.originalText,
        predictedSentiment: result.overallSentiment,
        isCorrect,
        reportedIssue: isCorrect ? null : 'User flagged prediction discrepancy',
        notes: isCorrect ? null : feedbackNotes.trim() || null,
      });
      if (resp.ok) {
        setFeedbackStatus(
          isCorrect
            ? 'Feedback recorded: Marked accurate (saved for review; not auto-used for training).'
            : 'Discrepancy flagged and stored in dataset review log.'
        );
        setFeedbackOpen(false);
        setFeedbackNotes('');
      }
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Statement Input Card */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              What does this statement actually mean?
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Domain-independent analysis across sentiment, comment type, tone, emotion, intent,
              sarcasm, negation, and dynamic aspects.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateSection(DashboardSection.BatchIngestion)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <span>Open Batch Intelligence</span>
          </button>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <label className="block space-y-2">
            <span className="sr-only">Statement to analyze</span>
            <textarea
              rows={5}
              value={statementText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Enter any sentence, comment, review, or statement to analyze..."
              className="w-full px-4 py-3 text-sm text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 leading-relaxed"
            />
          </label>

          {/* Optional Example Statements */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400">Try example:</span>
            {OPTIONAL_STATEMENT_EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => {
                  setStatementText(ex.text);
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-md transition-colors whitespace-nowrap"
              >
                {ex.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {statementText.length} / 4000 characters
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClear}
                disabled={isAnalyzing && !statementText && !result}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Clear</span>
              </button>

              <button
                type="submit"
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1322]"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
              </button>
            </div>
          </div>
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-lg border bg-rose-950/40 border-rose-500/30 text-rose-200 text-xs flex items-start gap-3"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-100">Validation / Analysis Error</p>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}
      </section>

      {/* Structured Analysis Outputs */}
      {result && (
        <div className="space-y-6">
          {/* 5 Independent Classification Dimensions */}
          <section
            aria-label="Independent Classification Dimensions"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
          >
            <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">A. Overall Sentiment</p>
              <div className="pt-0.5">
                <SentimentLabel polarity={result.overallSentiment} />
              </div>
              <p className="text-xs text-slate-400">
                Uncertainty:{' '}
                <span className="font-medium text-slate-200">{result.uncertaintyLevel}</span>
              </p>
            </div>

            <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">B. Comment Type</p>
              <p className="text-sm font-semibold text-white leading-snug">
                {result.commentTypes.join(' · ')}
              </p>
              <p className="text-xs text-slate-400">Pragmatic classification</p>
            </div>

            <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">C. Tone</p>
              <p className="text-sm font-semibold text-white">{result.tone}</p>
              <p className="text-xs text-slate-400">Delivery & attitude</p>
            </div>

            <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">D. Emotion</p>
              <p className="text-sm font-semibold text-white">{result.emotion}</p>
              <p className="text-xs text-slate-400">Expressed affect</p>
            </div>

            <div className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-medium text-slate-400">E. Communication Intent</p>
              <p className="text-sm font-semibold text-white leading-snug">
                {result.communicationIntent}
              </p>
              <p className="text-xs text-slate-400">Speaker objective</p>
            </div>
          </section>

          {/* Uncertainty / Ambiguity Banner if Moderate or High */}
          {(result.uncertaintyLevel !== 'Low' || result.insights.ambiguityNote) && (
            <section className="bg-amber-950/35 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-200">
              <AlertTriangle
                className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="font-semibold text-amber-100">
                  Ambiguity / Uncertainty Notice ({result.uncertaintyLevel} uncertainty)
                </p>
                <p className="leading-relaxed">
                  {result.uncertaintyReason ||
                    result.insights.ambiguityNote ||
                    'This statement may carry context-dependent or ambiguous intent.'}
                </p>
              </div>
            </section>
          )}

          {/* Interactive Word-Level Explorer */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Interactive Word-Level Explorer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any highlighted phrase to inspect its classification, aspect link, and
                  provenance
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
                {result.analysisId && <span className="font-mono">{result.analysisId}</span>}
                {processingTimeMs !== null && (
                  <span className="font-mono tabular-nums">{processingTimeMs} ms</span>
                )}
              </div>
            </div>

            <InteractiveWordExplorer
              text={result.originalText}
              spans={result.highlightedSpans}
            />
          </section>

          {/* Interpretation & Contextual Language Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section className="lg:col-span-7 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <div className="pb-3 border-b border-slate-800/80">
                <h3 className="font-display text-base font-semibold text-white">
                  Interpretation & Explanation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Post-classification natural-language interpretation
                </p>
              </div>

              <div className="space-y-3 text-sm text-slate-200 leading-relaxed">
                <p className="font-medium text-white">{result.insights.interpretation}</p>
                <p className="text-slate-300">{result.explanation}</p>
              </div>

              {(result.insights.positiveExpressions.length > 0 ||
                result.insights.negativeExpressions.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs">
                  {result.insights.positiveExpressions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium text-emerald-400">Positive Expressions</p>
                      <ul className="space-y-1 text-slate-300">
                        {result.insights.positiveExpressions.map((expr, idx) => (
                          <li key={idx}>"{expr}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.insights.negativeExpressions.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-medium text-rose-400">Negative Expressions</p>
                      <ul className="space-y-1 text-slate-300">
                        {result.insights.negativeExpressions.map((expr, idx) => (
                          <li key={idx}>"{expr}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Sarcasm, Irony, Negation & Confidence Provenance */}
            <section className="lg:col-span-5 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <div className="pb-3 border-b border-slate-800/80">
                <h3 className="font-display text-base font-semibold text-white">
                  Sarcasm, Context & Confidence
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Contextual markers and calibration status
                </p>
              </div>

              <dl className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-800/70">
                  <dt className="text-slate-400">Detected Language</dt>
                  <dd className="font-medium text-slate-100">
                    {result.languageAnalysis.detectedLanguage}
                  </dd>
                </div>

                <div className="py-1 border-b border-slate-800/70 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-400">Sarcasm / Irony</dt>
                    <dd
                      className={`font-medium ${
                        result.languageAnalysis.sarcasmOrIrony === 'Detected'
                          ? 'text-amber-400'
                          : 'text-slate-200'
                      }`}
                    >
                      {result.languageAnalysis.sarcasmOrIrony}
                    </dd>
                  </div>
                  {result.languageAnalysis.sarcasmNote && (
                    <p className="text-slate-300 leading-relaxed">
                      {result.languageAnalysis.sarcasmNote}
                    </p>
                  )}
                </div>

                <div className="py-1 border-b border-slate-800/70 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-slate-400">Negation / Double Negative</dt>
                    <dd className="font-medium text-slate-100">
                      {result.languageAnalysis.containsNegation ? 'Negation Present' : 'None'}
                      {result.languageAnalysis.containsDoubleNegative ? ' · Double Negative' : ''}
                    </dd>
                  </div>
                  {result.languageAnalysis.negationNote && (
                    <p className="text-slate-300 leading-relaxed">
                      {result.languageAnalysis.negationNote}
                    </p>
                  )}
                </div>

                {result.languageAnalysis.figurativeOrImplicitNote && (
                  <div className="py-1 border-b border-slate-800/70 space-y-1">
                    <dt className="text-slate-400">Figurative / Implicit Context</dt>
                    <dd className="text-slate-300 leading-relaxed">
                      {result.languageAnalysis.figurativeOrImplicitNote}
                    </dd>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <dt className="text-slate-400">Model Confidence</dt>
                  <dd className="font-medium text-slate-200">
                    {result.languageAnalysis.confidenceScore !== null
                      ? `${(result.languageAnalysis.confidenceScore * 100).toFixed(1)}%`
                      : result.languageAnalysis.confidenceStatus}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          {/* Aspect-Based Sentiment Analysis Table */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  Aspect-Based Sentiment Analysis
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Explicitly extracted terms separated from inferred aspect categories
                </p>
              </div>
              <span className="font-mono text-xs text-slate-400 tabular-nums">
                {result.aspects.length} aspect{result.aspects.length === 1 ? '' : 's'}
              </span>
            </div>

            {result.aspects.length === 0 ? (
              <div className="p-6 text-xs sm:text-sm text-slate-400">
                No reliable target aspect identified in this statement.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                      <th className="py-3 px-6 whitespace-nowrap">Aspect Term</th>
                      <th className="py-3 px-4 whitespace-nowrap">Aspect Category</th>
                      <th className="py-3 px-4 whitespace-nowrap">Extraction Mode</th>
                      <th className="py-3 px-4">Opinion Expression</th>
                      <th className="py-3 px-6 whitespace-nowrap">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {result.aspects.map((asp) => (
                      <tr key={asp.id} className="hover:bg-[#11192D]">
                        <td className="py-3.5 px-6 font-medium text-white whitespace-nowrap">
                          {asp.aspectTerm ? `"${asp.aspectTerm}"` : 'Implicit (No Term)'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                          {asp.aspectCategory}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {asp.isImplicit ? 'Inferred Category' : 'Explicit Term'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-200">{asp.opinionExpression}</td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <SentimentLabel polarity={asp.sentiment} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Explainable AI Feedback & Export Bar */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5 text-xs">
                <p className="font-semibold text-white">Prediction Review & Export</p>
                <p className="text-slate-400">
                  Flag inaccurate classifications for dataset preparation (never auto-treated as
                  verified training labels).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingFeedback}
                  onClick={() => handleSubmitFeedback(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap"
                >
                  <ThumbsUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Mark Accurate</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmittingFeedback}
                  onClick={() => setFeedbackOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Flag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Flag Incorrect</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportSingleStatementJson(result)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {feedbackOpen && (
              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Optional note: what should the sentiment, sarcasm, or aspect be?"
                  className="flex-1 px-3 py-2 text-xs text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <button
                  type="button"
                  disabled={isSubmittingFeedback}
                  onClick={() => handleSubmitFeedback(false)}
                  className="px-4 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  Submit Flag
                </button>
              </div>
            )}

            {feedbackStatus && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{feedbackStatus}</span>
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
