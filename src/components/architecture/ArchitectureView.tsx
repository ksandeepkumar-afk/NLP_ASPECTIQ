import { ARCHITECTURE_COMPONENT_DOCS } from '../../data/sampleDataset';

export function ArchitectureView() {
  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Modular System Architecture & Component Responsibilities
        </h2>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          AspectIQ is organized into decoupled modules so classical ML and deep learning models
          trained on SemEval-2014 can be integrated behind clean TypeScript service interfaces
          without coupling classifier predictions to Gemini natural-language explanations.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ARCHITECTURE_COMPONENT_DOCS.map((comp) => (
          <article
            key={comp.id}
            className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>{comp.layer}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-700">{comp.implementationStatus}</span>
              </div>

              <h3 className="font-display text-base font-semibold text-slate-900">{comp.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{comp.purpose}</p>
            </div>

            <dl className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500">Module Path</dt>
                <dd className="font-mono text-slate-800">{comp.modulePath}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500">Inputs</dt>
                <dd className="text-slate-800 sm:text-right">{comp.inputs}</dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <dt className="text-slate-500">Outputs</dt>
                <dd className="text-slate-800 sm:text-right">{comp.outputs}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
