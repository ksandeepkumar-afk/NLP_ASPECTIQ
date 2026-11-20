import { useState } from 'react';
import { Info } from 'lucide-react';
import { MODEL_REGISTRY_SPECS } from '../../data/sampleDataset';
import { ModelArchitectureSpec } from '../../types/absa';

export function ModelBenchmarksView() {
  const [selectedModel, setSelectedModel] = useState<ModelArchitectureSpec>(
    MODEL_REGISTRY_SPECS[3]
  );

  return (
    <div className="space-y-6">
      {/* Honest Status Notice */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1 text-xs sm:text-sm">
          <h2 className="font-display font-semibold text-slate-900">
            SemEval-2014 Evaluation Integrity Policy
          </h2>
          <p className="text-slate-600 leading-relaxed">
            This table holds candidate ML and deep learning ABSA architectures configured for the
            SemEval-2014 Task 4 (Laptops & Restaurants) benchmark. Metric cells remain unpopulated
            until actual training and test-split evaluation runs are executed—no simulated or
            hardcoded accuracy/F1 numbers are shown.
          </p>
        </div>
      </section>

      {/* Model Comparison Matrix */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Candidate ABSA Model Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a model row to inspect its architecture specification and training readiness
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {MODEL_REGISTRY_SPECS.length} registered architectures
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-3 px-6 whitespace-nowrap">Model Architecture</th>
                <th className="py-3 px-4 whitespace-nowrap">Family</th>
                <th className="py-3 px-4 whitespace-nowrap">Evaluation Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Accuracy</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Precision</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Recall</th>
                <th className="py-3 px-6 text-right whitespace-nowrap">Macro-F1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MODEL_REGISTRY_SPECS.map((model) => {
                const isSelected = selectedModel.id === model.id;
                return (
                  <tr
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3.5 px-6 font-medium text-slate-900 whitespace-nowrap">
                      {model.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{model.family}</td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      Awaiting Training Run
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                      {model.metrics ? `${model.metrics.accuracy.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                      {model.metrics ? `${model.metrics.precision.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                      {model.metrics ? `${model.metrics.recall.toFixed(2)}%` : '--'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-slate-400 tabular-nums">
                      {model.metrics ? `${model.metrics.f1Score.toFixed(2)}%` : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Selected Architecture Specification */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-2">
          <p className="text-xs font-medium text-slate-500">
            Selected Architecture · {selectedModel.family}
          </p>
          <h3 className="font-display text-base font-semibold text-slate-900">
            {selectedModel.name}
          </h3>
          <p className="text-sm text-slate-700 leading-relaxed">{selectedModel.purpose}</p>
        </div>

        <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-xs">
          <div>
            <p className="font-medium text-slate-500">Target Benchmark</p>
            <p className="text-slate-900 mt-0.5">{selectedModel.datasetTrack}</p>
          </div>
          <div>
            <p className="font-medium text-slate-500">Input Representation</p>
            <p className="text-slate-900 mt-0.5 leading-relaxed">
              {selectedModel.inputRepresentation}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
