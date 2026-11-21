import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Upload } from 'lucide-react';
import { fetchStoredBatchAnalytics } from '../../services/modelAdapter';
import {
  BatchAnalysisResult,
  DashboardSection,
  OverallSentiment,
  StoredBatchSummary,
} from '../../types/absa';

interface AnalyticsInsightsViewProps {
  activeBatch: BatchAnalysisResult | null;
  onNavigate: (section: DashboardSection) => void;
}

export function AnalyticsInsightsView({
  activeBatch,
  onNavigate,
}: AnalyticsInsightsViewProps) {
  const [storedBatches, setStoredBatches] = useState<StoredBatchSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchStoredBatchAnalytics().then((rows) => {
      setStoredBatches(rows);
      setLoaded(true);
    });
  }, [activeBatch]);

  const combinedBatches = useMemo(() => {
    const map = new Map<string, BatchAnalysisResult>();
    for (const b of storedBatches) {
      if (b.payload && Array.isArray(b.payload.results)) {
        map.set(b.batchId, b.payload);
      }
    }
    if (activeBatch) {
      map.set(activeBatch.datasetId, activeBatch);
    }
    return Array.from(map.values()).sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
  }, [storedBatches, activeBatch]);

  const filteredStatements = useMemo(() => {
    const batchesToInclude =
      selectedBatchId === 'ALL'
        ? combinedBatches
        : combinedBatches.filter((b) => b.datasetId === selectedBatchId);

    const statements = batchesToInclude.flatMap((b) =>
      b.results.map((r) => ({ ...r, batchAnalyzedAt: b.analyzedAt }))
    );

    if (!dateFilter.trim()) return statements;
    return statements.filter((s) => {
      const ts = s.timestamp || s.batchAnalyzedAt || '';
      return ts.startsWith(dateFilter.trim());
    });
  }, [combinedBatches, selectedBatchId, dateFilter]);

  const metrics = useMemo(() => {
    const sentimentCounts: Record<OverallSentiment, number> = {
      Positive: 0,
      Negative: 0,
      Neutral: 0,
      Mixed: 0,
    };
    const emotionMap = new Map<string, number>();
    const commentTypeMap = new Map<string, number>();
    const toneMap = new Map<string, number>();
    const aspectMap = new Map<
      string,
      { aspect: string; positive: number; negative: number; neutral: number; total: number }
    >();
    const timeSeriesMap = new Map<
      string,
      { date: string; Positive: number; Negative: number; Mixed: number; Neutral: number }
    >();

    for (const stmt of filteredStatements) {
      sentimentCounts[stmt.overallSentiment] += 1;
      emotionMap.set(stmt.emotion, (emotionMap.get(stmt.emotion) ?? 0) + 1);
      toneMap.set(stmt.tone, (toneMap.get(stmt.tone) ?? 0) + 1);
      for (const ct of stmt.commentTypes) {
        commentTypeMap.set(ct, (commentTypeMap.get(ct) ?? 0) + 1);
      }

      for (const asp of stmt.aspects) {
        const entry = aspectMap.get(asp.aspectCategory) ?? {
          aspect: asp.aspectCategory,
          positive: 0,
          negative: 0,
          neutral: 0,
          total: 0,
        };
        if (asp.sentiment === 'Positive') entry.positive += 1;
        if (asp.sentiment === 'Negative') entry.negative += 1;
        if (asp.sentiment === 'Neutral') entry.neutral += 1;
        entry.total += 1;
        aspectMap.set(asp.aspectCategory, entry);
      }

      if (stmt.timestamp) {
        const day = stmt.timestamp.slice(0, 10);
        const bucket = timeSeriesMap.get(day) ?? {
          date: day,
          Positive: 0,
          Negative: 0,
          Mixed: 0,
          Neutral: 0,
        };
        bucket[stmt.overallSentiment] += 1;
        timeSeriesMap.set(day, bucket);
      }
    }

    const toSortedList = (m: Map<string, number>) =>
      Array.from(m.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);

    const aspectList = Array.from(aspectMap.values()).sort((a, b) => b.total - a.total);
    const positiveAspects = aspectList
      .filter((a) => a.positive > 0)
      .sort((a, b) => b.positive - a.positive)
      .slice(0, 6);
    const negativeAspects = aspectList
      .filter((a) => a.negative > 0)
      .sort((a, b) => b.negative - a.negative)
      .slice(0, 6);

    const timeTrend = Array.from(timeSeriesMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return {
      total: filteredStatements.length,
      sentimentCounts,
      emotions: toSortedList(emotionMap),
      commentTypes: toSortedList(commentTypeMap),
      tones: toSortedList(toneMap),
      aspects: aspectList,
      positiveAspects,
      negativeAspects,
      timeTrend,
    };
  }, [filteredStatements]);

  if (loaded && combinedBatches.length === 0) {
    return (
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-12 text-center max-w-3xl mx-auto my-6 space-y-5">
        <div className="w-12 h-12 rounded-xl bg-[#131B2E] border border-slate-800 flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6 text-blue-400" aria-hidden="true" />
        </div>
        <div className="space-y-2 max-w-md mx-auto">
          <h2 className="font-display text-xl font-semibold text-white">
            No Analyzed Datasets Available
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Analytics and insights are computed exclusively from real processed batch datasets.
            Run a batch analysis or upload a CSV to populate distributions and trends.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate(DashboardSection.BatchIngestion)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Open Batch Intelligence</span>
        </button>
      </section>
    );
  }

  const maxAspectTotal = Math.max(1, ...metrics.aspects.map((a) => a.total));
  const maxEmotion = Math.max(1, ...metrics.emotions.map((e) => e.count));
  const maxCommentType = Math.max(1, ...metrics.commentTypes.map((c) => c.count));
  const maxTone = Math.max(1, ...metrics.tones.map((t) => t.count));

  return (
    <div className="space-y-6">
      {/* Dataset & Date Filters */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-white">
            Analytics & Cross-Dataset Insights
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            Aggregating {metrics.total} real analyzed statements across{' '}
            {selectedBatchId === 'ALL' ? `${combinedBatches.length} batches` : '1 selected batch'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            aria-label="Filter by dataset"
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
          >
            <option value="ALL">All Persisted Batches ({combinedBatches.length})</option>
            {combinedBatches.map((b) => (
              <option key={b.datasetId} value={b.datasetId}>
                {b.datasetName} ({b.totalStatementsAnalyzed})
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="Filter by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
          />

          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="px-2.5 py-2 text-slate-400 hover:text-white"
            >
              Reset Date
            </button>
          )}
        </div>
      </section>

      {/* Sentiment Distribution Bar */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-white">
            Sentiment Distribution
          </h3>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {metrics.total} statements
          </span>
        </div>

        <div className="h-4 w-full bg-[#131B2E] rounded-sm overflow-hidden flex">
          {(['Positive', 'Mixed', 'Neutral', 'Negative'] as OverallSentiment[]).map((sent) => {
            const count = metrics.sentimentCounts[sent];
            const pct = metrics.total > 0 ? (count / metrics.total) * 100 : 0;
            if (pct === 0) return null;
            const color =
              sent === 'Positive'
                ? 'bg-emerald-500'
                : sent === 'Mixed'
                ? 'bg-amber-400'
                : sent === 'Negative'
                ? 'bg-rose-500'
                : 'bg-slate-500';
            return <div key={sent} className={`h-full ${color}`} style={{ width: `${pct}%` }} />;
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          {(['Positive', 'Mixed', 'Neutral', 'Negative'] as OverallSentiment[]).map((sent) => {
            const count = metrics.sentimentCounts[sent];
            const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
            return (
              <div key={sent}>
                <span className="text-slate-400 block">{sent}</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3-Column Distribution Grid: Emotion, Comment Type, Tone */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold text-white pb-2 border-b border-slate-800/80">
            Emotion Distribution
          </h3>
          {metrics.emotions.slice(0, 8).map((item) => (
            <div key={item.label} className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-200">{item.label}</span>
                <span className="font-mono text-slate-400 tabular-nums">{item.count}</span>
              </div>
              <div className="h-2 bg-[#131B2E] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-cyan-500"
                  style={{ width: `${(item.count / maxEmotion) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold text-white pb-2 border-b border-slate-800/80">
            Comment-Type Distribution
          </h3>
          {metrics.commentTypes.slice(0, 8).map((item) => (
            <div key={item.label} className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-200">{item.label}</span>
                <span className="font-mono text-slate-400 tabular-nums">{item.count}</span>
              </div>
              <div className="h-2 bg-[#131B2E] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(item.count / maxCommentType) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-3">
          <h3 className="font-display text-sm font-semibold text-white pb-2 border-b border-slate-800/80">
            Tone Distribution
          </h3>
          {metrics.tones.slice(0, 8).map((item) => (
            <div key={item.label} className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-200">{item.label}</span>
                <span className="font-mono text-slate-400 tabular-nums">{item.count}</span>
              </div>
              <div className="h-2 bg-[#131B2E] rounded-sm overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${(item.count / maxTone) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Aspect-Level Sentiment & Positive vs Negative Subject Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white pb-2 border-b border-slate-800/80">
            Aspect-Level Sentiment & Topic Frequency
          </h3>
          {metrics.aspects.length === 0 ? (
            <p className="text-xs text-slate-400">No aspect mentions found in filtered records.</p>
          ) : (
            <div className="space-y-3.5">
              {metrics.aspects.slice(0, 10).map((row) => {
                const widthScale = (row.total / maxAspectTotal) * 100;
                const posPct = (row.positive / row.total) * 100;
                const neuPct = (row.neutral / row.total) * 100;
                const negPct = (row.negative / row.total) * 100;
                return (
                  <div key={row.aspect} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-200">{row.aspect}</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {row.positive}+ / {row.neutral}~ / {row.negative}- ({row.total})
                      </span>
                    </div>
                    <div className="h-3 bg-[#131B2E] rounded-sm overflow-hidden">
                      <div className="h-full flex" style={{ width: `${widthScale}%` }}>
                        {posPct > 0 && (
                          <div className="h-full bg-emerald-500" style={{ width: `${posPct}%` }} />
                        )}
                        {neuPct > 0 && (
                          <div className="h-full bg-slate-500" style={{ width: `${neuPct}%` }} />
                        )}
                        {negPct > 0 && (
                          <div className="h-full bg-rose-500" style={{ width: `${negPct}%` }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
          <h3 className="font-display text-base font-semibold text-white pb-2 border-b border-slate-800/80">
            Positive vs. Negative Topic Comparison
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <p className="font-semibold text-emerald-400">Top Positive Subjects</p>
              {metrics.positiveAspects.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                <ul className="space-y-1.5">
                  {metrics.positiveAspects.map((a) => (
                    <li key={a.aspect} className="flex justify-between gap-2">
                      <span className="text-slate-300 truncate">{a.aspect}</span>
                      <span className="font-mono text-emerald-400 tabular-nums">{a.positive}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <p className="font-semibold text-rose-400">Top Negative Subjects</p>
              {metrics.negativeAspects.length === 0 ? (
                <p className="text-slate-500">None</p>
              ) : (
                <ul className="space-y-1.5">
                  {metrics.negativeAspects.map((a) => (
                    <li key={a.aspect} className="flex justify-between gap-2">
                      <span className="text-slate-300 truncate">{a.aspect}</span>
                      <span className="font-mono text-rose-400 tabular-nums">{a.negative}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {metrics.timeTrend.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-2 text-xs">
              <p className="font-semibold text-slate-200">Sentiment Over Timestamped Dates</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {metrics.timeTrend.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between font-mono tabular-nums"
                  >
                    <span className="text-slate-400">{day.date}</span>
                    <span className="text-slate-200">
                      +{day.Positive} · ~{day.Neutral + day.Mixed} · -{day.Negative}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
