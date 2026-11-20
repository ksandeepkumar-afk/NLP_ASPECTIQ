import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Cpu, MessageSquareText } from 'lucide-react';
import { MODEL_REGISTRY_SPECS } from '../../data/sampleDataset';
import { absaModelAdapter, InferenceResponse } from '../../services/modelAdapter';
import { geminiExplanationService } from '../../services/explanationService';
import {
  AspectSpanPrediction,
  GeminiExplanationPayload,
  ReviewDomain,
  SampleReviewRecord,
  SentimentPolarity,
} from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';

interface ReviewWorkbenchProps {
  sampleReviews: SampleReviewRecord[];
  selectedSampleId: string;
  onSelectSampleId: (id: string) => void;
}

function renderHighlightedReviewText(text: string, aspects: AspectSpanPrediction[]) {
  if (aspects.length === 0) {
    return <span>{text}</span>;
  }

  const sorted = [...aspects].sort((a, b) => a.startOffset - b.startOffset);
  const segments: Array<{ key: string; content: string; aspect?: AspectSpanPrediction }> = [];
  let cursor = 0;

  for (const asp of sorted) {
    if (asp.startOffset < cursor || asp.endOffset > text.length) continue;
    if (asp.startOffset > cursor) {
      segments.push({
        key: `txt-${cursor}`,
        content: text.slice(cursor, asp.startOffset),
      });
    }
    segments.push({
      key: asp.id,
      content: text.slice(asp.startOffset, asp.endOffset),
      aspect: asp,
    });
    cursor = asp.endOffset;
  }

  if (cursor < text.length) {
    segments.push({
      key: `txt-${cursor}`,
      content: text.slice(cursor),
    });
  }

  return (
    <>
      {segments.map((seg) => {
        if (!seg.aspect) {
          return <span key={seg.key}>{seg.content}</span>;
        }
        const highlightClass =
          seg.aspect.polarity === SentimentPolarity.Positive
            ? 'bg-emerald-50 text-emerald-900 border-b-2 border-emerald-600'
            : seg.aspect.polarity === SentimentPolarity.Negative
            ? 'bg-rose-50 text-rose-900 border-b-2 border-rose-600'
            : 'bg-slate-100 text-slate-900 border-b-2 border-slate-500';

        return (
          <mark key={seg.key} className={`${highlightClass} px-1 rounded-xs font-medium`}>
            {seg.content}
          </mark>
        );
      })}
    </>
  );
}

export function ReviewWorkbench({
  sampleReviews,
  selectedSampleId,
  onSelectSampleId,
}: ReviewWorkbenchProps) {
  const [mode, setMode] = useState<'sample' | 'custom'>('sample');
  const [customText, setCustomText] = useState('');
  const [customDomain, setCustomDomain] = useState<ReviewDomain>(ReviewDomain.Electronics);
  const [selectedModelId, setSelectedModelId] = useState<string>(MODEL_REGISTRY_SPECS[3].id);
  const [inferenceResult, setInferenceResult] = useState<InferenceResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanationResult, setExplanationResult] = useState<GeminiExplanationPayload | null>(null);

  const activeSample =
    sampleReviews.find((item) => item.id === selectedSampleId) ?? sampleReviews[0];

  useEffect(() => {
    setExplanationResult(null);
  }, [selectedSampleId, mode]);

  const handleRunCustomValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await absaModelAdapter.predictAspects({
        reviewText: customText,
        domain: customDomain,
        modelId: selectedModelId,
      });
      setInferenceResult(response);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestExplanationPreview = async () => {
    if (!activeSample) return;
    const result = await geminiExplanationService.generateAspectExplanation({
      reviewText: activeSample.reviewText,
      aspects: activeSample.prediction.aspects,
    });
    setExplanationResult(result);
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Single Review Inspection & Input Validation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect annotated sample records or test client-side validation on custom review input
          </p>
        </div>

        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0 self-start sm:self-center"
          role="group"
          aria-label="Workbench mode"
        >
          <button
            type="button"
            onClick={() => setMode('sample')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'sample'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inspect Sample Record
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'custom'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Test Custom Input
          </button>
        </div>
      </div>

      {mode === 'sample' && activeSample && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Sample Selector & Span Highlighted Text */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Sample Record · {activeSample.domain} · {activeSample.createdAt}
                </p>
                <h3 className="font-display text-base font-semibold text-slate-900 mt-0.5">
                  {activeSample.productOrVenue}
                </h3>
              </div>

              <label className="block shrink-0">
                <span className="sr-only">Select sample review</span>
                <select
                  value={activeSample.id}
                  onChange={(e) => onSelectSampleId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {sampleReviews.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id} — {item.productOrVenue}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">
                Review Text with Sample Aspect Span Highlights
              </p>
              <blockquote className="text-sm leading-relaxed text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4">
                {renderHighlightedReviewText(
                  activeSample.reviewText,
                  activeSample.prediction.aspects
                )}
              </blockquote>
            </div>

            {/* Prediction Layer Table (Clearly separated from Gemini explanations) */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  <h4 className="text-sm font-semibold text-slate-900">
                    Layer 1: Model Prediction Structure (Sample Data)
                  </h4>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {activeSample.prediction.aspects.length} aspects
                </span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <th className="py-2.5 px-4">Aspect Term</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Sample Polarity</th>
                      <th className="py-2.5 px-4 text-right">Span Offsets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSample.prediction.aspects.map((asp) => (
                      <tr key={asp.id}>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          "{asp.aspectTerm}"
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{asp.aspectCategory}</td>
                        <td className="py-2.5 px-4">
                          <SentimentLabel polarity={asp.polarity} />
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                          {asp.startOffset}..{asp.endOffset}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">
                Source: {activeSample.prediction.modelIdentifier}. Confidence scores remain null
                until a trained classifier runs inference.
              </p>
            </div>
          </section>

          {/* Right: Decoupled Gemini Explanation Layer */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-2.5 pb-4 border-b border-slate-100">
              <MessageSquareText className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h4 className="font-display text-sm font-semibold text-slate-900">
                  Layer 2: Gemini Explanation Service (Decoupled)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generates post-hoc human-readable rationales without altering classifier outputs
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                Architectural Rule: Aspect extraction and sentiment classification are produced
                exclusively by trained ML/DL models. The Gemini explanation service only explains
                already-predicted aspect spans.
              </p>
              <p className="text-slate-500">
                Current status: Staged interface (not connected in Phase 1).
              </p>
            </div>

            <button
              type="button"
              onClick={handleRequestExplanationPreview}
              className="w-full px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Inspect Explanation Service Response
            </button>

            {explanationResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-1.5">
                <p className="font-medium text-slate-900">
                  Service Status: {explanationResult.status}
                </p>
                <p className="leading-relaxed text-slate-600">{explanationResult.disclaimer}</p>
              </div>
            )}
          </section>
        </div>
      )}

      {mode === 'custom' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 max-w-3xl space-y-5">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Custom Review Input & Validation Check
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Validates review input against the ABSA model adapter contract. No fabricated
              predictions will be generated.
            </p>
          </div>

          <form onSubmit={handleRunCustomValidation} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Target Domain</span>
                <select
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value as ReviewDomain)}
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <option value={ReviewDomain.Electronics}>Electronics (SemEval Laptops)</option>
                  <option value={ReviewDomain.Restaurants}>Restaurants (SemEval Restaurants)</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Target Model Architecture</span>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {MODEL_REGISTRY_SPECS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} (Awaiting Training)
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                Customer Review Text (8–4,000 characters)
              </span>
              <textarea
                rows={4}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Example: The camera autofocus is fast in daylight, but battery life drops quickly when streaming video."
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </label>

            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {customText.trim().length} / 4000 chars
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              >
                {isSubmitting ? 'Validating...' : 'Validate & Dispatch to Adapter'}
              </button>
            </div>
          </form>

          {inferenceResult && (
            <div
              role="status"
              className={`p-4 rounded-lg border text-xs flex items-start gap-3 ${
                inferenceResult.errorCode === 'VALIDATION_ERROR'
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {inferenceResult.errorCode === 'VALIDATION_ERROR' ? (
                <AlertCircle className="w-4 h-4 text-rose-700 mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {inferenceResult.errorCode === 'VALIDATION_ERROR'
                    ? 'Input Validation Failed'
                    : 'Input Passed Validation · Live Model Endpoint Not Connected'}
                </p>
                <p className="leading-relaxed">{inferenceResult.statusMessage}</p>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
