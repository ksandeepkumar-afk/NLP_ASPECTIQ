import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Info,
  Loader2,
  Play,
  Upload,
} from 'lucide-react';
import {
  MODEL_REGISTRY_SPECS,
  SEMEVAL_STYLE_LABELED_CORPUS,
} from '../../data/sampleDataset';
import { parseLabeledEvaluationCsv } from '../../services/csvParser';
import {
  fetchEvaluationRuns,
  runLocalModelEvaluation,
} from '../../services/modelAdapter';
import { ModelArchitectureSpec, StoredEvaluationRecord } from '../../types/absa';

export function ModelBenchmarksView() {
  const [selectedModel, setSelectedModel] = useState<ModelArchitectureSpec>(
    MODEL_REGISTRY_SPECS[0]
  );
  const [evalRuns, setEvalRuns] = useState<StoredEvaluationRecord[]>([]);
  const [activeEval, setActiveEval] = useState<StoredEvaluationRecord | null>(null);
  const [isRunningEval, setIsRunningEval] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvaluationRuns().then((runs) => {
      setEvalRuns(runs);
      if (runs.length > 0) {
        setActiveEval(runs[0]);
      }
    });
  }, []);

  const latestTfidfEval = evalRuns.find((r) => r.modelId === 'tfidf-logreg') ?? null;

  const handleRunBuiltInEval = async () => {
    setIsRunningEval(true);
    setEvalError(null);
    try {
      const resp = await runLocalModelEvaluation({
        datasetName: 'SemEval-Style 30-Sample Sentiment Split',
        samples: SEMEVAL_STYLE_LABELED_CORPUS,
        epochs: 40,
      });
      if (!resp.ok || !resp.record) {
        setEvalError(resp.errorMessage ?? 'Failed to run model evaluation.');
        return;
      }
      setEvalRuns((prev) => [resp.record!, ...prev]);
      setActiveEval(resp.record);
    } finally {
      setIsRunningEval(false);
    }
  };

  const handleUploadLabeledCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setEvalError(null);
    const parsed = await parseLabeledEvaluationCsv(file);
    event.target.value = '';

    if (parsed.error) {
      setEvalError(parsed.error);
      return;
    }

    setIsRunningEval(true);
    try {
      const resp = await runLocalModelEvaluation({
        datasetName: file.name,
        samples: parsed.samples,
        epochs: 40,
      });
      if (!resp.ok || !resp.record) {
        setEvalError(resp.errorMessage ?? 'Failed to evaluate uploaded dataset.');
        return;
      }
      setEvalRuns((prev) => [resp.record!, ...prev]);
      setActiveEval(resp.record);
    } finally {
      setIsRunningEval(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Evaluation Policy Banner */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1 text-xs sm:text-sm">
          <h2 className="font-display font-semibold text-white">
            Model Comparison & Genuine Evaluation Policy
          </h2>
          <p className="text-slate-400 leading-relaxed">
            No fabricated benchmark numbers are stored.{' '}
            <span className="font-medium text-slate-200">TF-IDF + Logistic Regression</span> runs
            real local gradient-descent training and held-out evaluation on labeled datasets. Deep
            learning architectures (LSTM, Attention-LSTM, BERT) require a Python PyTorch runtime and
            display <code className="font-mono text-slate-300">--</code> until evaluated. Live API
            inference is tracked separately and never presented as a trained benchmark model.
          </p>
        </div>
      </section>

      {/* Run Real Evaluation Controls */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-display text-base font-semibold text-white">
            Run Local Train / Test Evaluation (TF-IDF + Logistic Regression)
          </h3>
          <p className="text-xs text-slate-400">
            Trains on 80% stratified split and evaluates on 20% held-out split to compute Accuracy,
            Macro P/R/F1, Confusion Matrix, and Epoch Loss.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isRunningEval}
            onClick={handleRunBuiltInEval}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {isRunningEval ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>Run SemEval-Style Split (30 Samples)</span>
          </button>

          <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
            <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Evaluate Labeled CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleUploadLabeledCsv}
              disabled={isRunningEval}
              className="sr-only"
            />
          </label>
        </div>
      </section>

      {evalError && (
        <section
          role="alert"
          className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
          <p>{evalError}</p>
        </section>
      )}

      {/* Model Comparison Matrix */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Registered NLP Architectures
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Metrics appear only after a genuine evaluation run has completed
            </p>
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {evalRuns.length} persisted evaluation run{evalRuns.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#131B2E] border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-3 px-6 whitespace-nowrap">Model</th>
                <th className="py-3 px-4 whitespace-nowrap">Family</th>
                <th className="py-3 px-4 whitespace-nowrap">Runtime Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Accuracy</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Precision</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Recall</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Macro-F1</th>
                <th className="py-3 px-6 text-right whitespace-nowrap">Train / Inf (ms)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {MODEL_REGISTRY_SPECS.map((model) => {
                const isSelected = selectedModel.id === model.id;
                const run = model.id === 'tfidf-logreg' ? latestTfidfEval : null;
                return (
                  <tr
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-500/10' : 'hover:bg-[#11192D]'
                    }`}
                  >
                    <td className="py-3.5 px-6 font-medium text-white whitespace-nowrap">
                      {model.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">{model.family}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={
                          run
                            ? 'text-emerald-400 font-medium'
                            : model.inferenceStatus === 'Active Internal API Provider'
                            ? 'text-blue-400 font-medium'
                            : 'text-slate-400'
                        }
                      >
                        {run ? `Evaluated (${run.datasetSize} rows)` : model.inferenceStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {run ? `${run.accuracy.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {run ? `${run.precisionMacro.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {run ? `${run.recallMacro.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-200 tabular-nums">
                      {run ? `${run.f1Macro.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-slate-300 tabular-nums">
                      {run ? `${run.trainingTimeMs} / ${run.inferenceTimeMs}` : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Evaluation Results: Confusion Matrix & Loss Curve */}
      {activeEval && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Confusion Matrix */}
          <section className="lg:col-span-6 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800/80">
              <h3 className="font-display text-base font-semibold text-white">
                Held-Out Confusion Matrix — {activeEval.datasetName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                Train: {activeEval.trainSize} · Test: {activeEval.testSize} · Accuracy:{' '}
                {activeEval.accuracy}% · Macro-F1: {activeEval.f1Macro}%
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2 px-3 text-left">True \ Pred</th>
                    {activeEval.labels.map((lbl) => (
                      <th key={lbl} className="py-2 px-3">
                        {lbl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeEval.labels.map((rowLbl, rIdx) => (
                    <tr key={rowLbl}>
                      <td className="py-2.5 px-3 text-left font-medium text-slate-200">
                        {rowLbl}
                      </td>
                      {activeEval.confusionMatrix[rIdx]?.map((count, cIdx) => (
                        <td
                          key={cIdx}
                          className={`py-2.5 px-3 font-mono tabular-nums ${
                            rIdx === cIdx
                              ? 'bg-emerald-500/15 font-semibold text-emerald-300'
                              : count > 0
                              ? 'bg-rose-500/15 text-rose-300'
                              : 'text-slate-500'
                          }`}
                        >
                          {count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">{activeEval.notes}</p>
          </section>

          {/* Training & Validation Cross-Entropy Loss */}
          <section className="lg:col-span-6 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="pb-3 border-b border-slate-800/80">
              <h3 className="font-display text-base font-semibold text-white">
                Training vs. Validation Loss
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Recorded multinomial cross-entropy loss across gradient-descent epochs
              </p>
            </div>

            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-2 px-4">Epoch</th>
                    <th className="py-2 px-4 text-right">Train Loss</th>
                    <th className="py-2 px-4 text-right">Validation Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                  {activeEval.lossHistory.map((pt) => (
                    <tr key={pt.epoch}>
                      <td className="py-2 px-4 text-slate-300">{pt.epoch}</td>
                      <td className="py-2 px-4 text-right text-blue-400">
                        {pt.trainLoss.toFixed(4)}
                      </td>
                      <td className="py-2 px-4 text-right text-slate-300">
                        {pt.valLoss.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Selected Architecture Specification */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-2">
          <p className="text-xs font-medium text-slate-400">
            Selected · {selectedModel.family} · {selectedModel.inferenceStatus}
          </p>
          <h3 className="font-display text-base font-semibold text-white">
            {selectedModel.name}
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">{selectedModel.purpose}</p>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-6 text-xs">
          <div>
            <p className="font-medium text-slate-400">Benchmark Track</p>
            <p className="text-slate-100 mt-0.5">{selectedModel.datasetTrack}</p>
          </div>
          <div>
            <p className="font-medium text-slate-400">Input Representation</p>
            <p className="text-slate-100 mt-0.5 leading-relaxed">
              {selectedModel.inputRepresentation}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
