import { useMemo, useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { buildSampleAspectSummary } from '../../data/sampleDataset';
import {
  DashboardSection,
  ReviewDomain,
  SampleReviewRecord,
  SentimentPolarity,
} from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';

interface OverviewDashboardProps {
  sampleReviews: SampleReviewRecord[];
  onNavigate: (section: DashboardSection) => void;
  onInspectReview: (reviewId: string) => void;
}

export function OverviewDashboard({
  sampleReviews,
  onNavigate,
  onInspectReview,
}: OverviewDashboardProps) {
  const [domainFilter, setDomainFilter] = useState<'All' | ReviewDomain>('All');

  const filteredReviews = useMemo(() => {
    if (domainFilter === 'All') return sampleReviews;
    return sampleReviews.filter((r) => r.domain === domainFilter);
  }, [sampleReviews, domainFilter]);

  const aspectSummary = useMemo(
    () => buildSampleAspectSummary(filteredReviews),
    [filteredReviews]
  );

  const totals = useMemo(() => {
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    for (const row of aspectSummary) {
      positive += row.positiveCount;
      neutral += row.neutralCount;
      negative += row.negativeCount;
    }
    const mentions = positive + neutral + negative;
    return {
      reviewCount: filteredReviews.length,
      mentionCount: mentions,
      categoryCount: new Set(aspectSummary.map((r) => r.aspectCategory)).size,
      positive,
      neutral,
      negative,
    };
  }, [filteredReviews.length, aspectSummary]);

  const maxCategoryTotal = useMemo(
    () => Math.max(1, ...aspectSummary.map((item) => item.totalMentions)),
    [aspectSummary]
  );

  return (
    <div className="space-y-6">
      {/* Sample Data Provenance Notice (Clean hairline border, no thick left stripe) */}
      <section
        aria-label="Sample data provenance notice"
        className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-sm text-slate-700 space-y-0.5">
            <p className="font-medium text-slate-900">
              Sample Preview Mode — Illustrative Dataset Only
            </p>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Metrics and aspect annotations below come from static sample records for layout
              verification. Model training on SemEval-2014 and live inference are not connected yet.
            </p>
          </div>
        </div>

        {/* Interactive Domain Filter Segmented Control */}
        <div
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg shrink-0 self-start sm:self-center"
          role="group"
          aria-label="Filter sample reviews by domain"
        >
          {(['All', ReviewDomain.Electronics, ReviewDomain.Restaurants] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDomainFilter(option)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                domainFilter === option
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      {/* 4-Column Quantitative Summary Strip */}
      <section aria-label="Sample dataset summary metrics" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Sample Reviews Loaded</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totals.reviewCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Domain filter: {domainFilter} · Sample data
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Sample Aspect Mentions</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totals.mentionCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {totals.categoryCount} distinct aspect categories
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Sample Polarity Split</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {totals.positive} / {totals.neutral} / {totals.negative}
          </p>
          <p className="mt-1 text-xs text-slate-500">Positive / Neutral / Negative mentions</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Trained Models Connected</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            0 / 4
          </p>
          <p className="mt-1 text-xs text-slate-500">SemEval-2014 training pending</p>
        </div>
      </section>

      {/* Main Visualization & Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Aspect-Wise Sentiment Distribution Chart */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Aspect-Wise Sentiment Distribution (Sample Data)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Proportion of positive, neutral, and negative sample mentions per aspect category
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs" aria-hidden="true" />
                Positive
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-400 rounded-xs" aria-hidden="true" />
                Neutral
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs" aria-hidden="true" />
                Negative
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4 flex-1">
            {aspectSummary.map((row) => {
              const widthScale = (row.totalMentions / maxCategoryTotal) * 100;
              const posPct = (row.positiveCount / row.totalMentions) * 100;
              const neuPct = (row.neutralCount / row.totalMentions) * 100;
              const negPct = (row.negativeCount / row.totalMentions) * 100;

              return (
                <div key={`${row.domain}-${row.aspectCategory}`} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4 text-xs">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-medium text-slate-800 truncate">
                        {row.aspectCategory}
                      </span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500">{row.domain}</span>
                    </div>
                    <span className="font-mono text-slate-600 tabular-nums shrink-0">
                      {row.positiveCount}+ / {row.neutralCount}~ / {row.negativeCount}- ({row.totalMentions})
                    </span>
                  </div>

                  <div className="h-3 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full flex"
                      style={{ width: `${widthScale}%` }}
                      role="img"
                      aria-label={`${row.aspectCategory}: ${row.positiveCount} positive, ${row.neutralCount} neutral, ${row.negativeCount} negative`}
                    >
                      {posPct > 0 && (
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${posPct}%` }}
                        />
                      )}
                      {neuPct > 0 && (
                        <div
                          className="h-full bg-slate-400"
                          style={{ width: `${neuPct}%` }}
                        />
                      )}
                      {negPct > 0 && (
                        <div
                          className="h-full bg-rose-600"
                          style={{ width: `${negPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Aggregate Balance & Next Steps */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-6">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Corpus Polarity Breakdown (Sample Data)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution across all extracted sample aspect spans
            </p>

            <div className="mt-6 space-y-4">
              {[
                {
                  label: 'Positive Aspects',
                  count: totals.positive,
                  barColor: 'bg-emerald-600',
                  polarity: SentimentPolarity.Positive,
                },
                {
                  label: 'Neutral Aspects',
                  count: totals.neutral,
                  barColor: 'bg-slate-400',
                  polarity: SentimentPolarity.Neutral,
                },
                {
                  label: 'Negative Aspects',
                  count: totals.negative,
                  barColor: 'bg-rose-600',
                  polarity: SentimentPolarity.Negative,
                },
              ].map((item) => {
                const pct =
                  totals.mentionCount > 0
                    ? Math.round((item.count / totals.mentionCount) * 100)
                    : 0;
                return (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className={`h-full ${item.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-700">
              Staged Project Workflows
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate(DashboardSection.Workbench)}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Open Review Workbench</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate(DashboardSection.CsvIngestion)}
                className="flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Test CSV Validation</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Sample Reviews & Aspect Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Sample Customer Reviews & Reference Aspects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any row to inspect inline aspect spans in the Review Workbench
            </p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {filteredReviews.length} sample records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                <th className="py-3 px-6 whitespace-nowrap">Sample ID</th>
                <th className="py-3 px-4 whitespace-nowrap">Domain</th>
                <th className="py-3 px-4">Review Excerpt</th>
                <th className="py-3 px-4 whitespace-nowrap">Sample Aspect Polarities</th>
                <th className="py-3 px-6 text-right whitespace-nowrap">Aspects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredReviews.map((review) => (
                <tr
                  key={review.id}
                  onClick={() => onInspectReview(review.id)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-6 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                    {review.id}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                    {review.domain}
                  </td>
                  <td className="py-3.5 px-4 text-slate-800 max-w-md">
                    <p className="font-medium text-xs text-slate-500 mb-0.5">
                      {review.productOrVenue}
                    </p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-700">
                      {review.reviewText}
                    </p>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {review.prediction.aspects.map((asp) => (
                        <div key={asp.id} className="inline-flex items-center gap-1.5 text-xs">
                          <span className="text-slate-700 font-medium">{asp.aspectCategory}:</span>
                          <SentimentLabel polarity={asp.polarity} />
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-right font-mono text-xs text-slate-600 tabular-nums">
                    {review.prediction.aspects.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
