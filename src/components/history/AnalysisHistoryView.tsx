import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Download,
  ExternalLink,
  Search,
  Trash2,
} from 'lucide-react';
import {
  deleteHistoryRecord,
  fetchHistory,
  fetchHistoryRecord,
  fetchPredictionFeedback,
} from '../../services/modelAdapter';
import {
  exportConversationJson,
  exportPredictionsCsv,
  exportSingleStatementJson,
} from '../../services/reportExport';
import {
  BatchAnalysisResult,
  ConversationAnalysisResult,
  HistorySummaryRecord,
  PredictionFeedbackRecord,
  StatementAnalysisOutput,
} from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';

interface AnalysisHistoryViewProps {
  onReopenStatement: (stmt: StatementAnalysisOutput) => void;
  onReopenBatch: (batch: BatchAnalysisResult) => void;
  onReopenConversation: (conv: ConversationAnalysisResult) => void;
}

export function AnalysisHistoryView({
  onReopenStatement,
  onReopenBatch,
  onReopenConversation,
}: AnalysisHistoryViewProps) {
  const [records, setRecords] = useState<HistorySummaryRecord[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<PredictionFeedbackRecord[]>([]);
  const [storageEngine, setStorageEngine] = useState('SQLite (node:sqlite)');
  const [searchQuery, setSearchQuery] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [hist, fb] = await Promise.all([
        fetchHistory({
          search: searchQuery,
          sentiment: sentimentFilter,
          date: dateFilter,
        }),
        fetchPredictionFeedback(),
      ]);
      setRecords(hist.records);
      setStorageEngine(hist.storageEngine);
      setFeedbackRows(fb);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, sentimentFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReopen = async (id: string) => {
    const res = await fetchHistoryRecord(id);
    if (!res) return;
    if (res.sourceType === 'statement') {
      onReopenStatement(res.payload as StatementAnalysisOutput);
    } else if (res.sourceType === 'batch') {
      onReopenBatch(res.payload as BatchAnalysisResult);
    } else if (res.sourceType === 'conversation') {
      onReopenConversation(res.payload as ConversationAnalysisResult);
    }
  };

  const handleExport = async (id: string) => {
    const res = await fetchHistoryRecord(id);
    if (!res) return;
    if (res.sourceType === 'statement') {
      exportSingleStatementJson(res.payload as StatementAnalysisOutput);
    } else if (res.sourceType === 'batch') {
      exportPredictionsCsv(res.payload as BatchAnalysisResult);
    } else if (res.sourceType === 'conversation') {
      exportConversationJson(res.payload as ConversationAnalysisResult);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteHistoryRecord(id);
    if (ok) {
      setRecords((prev) => prev.filter((r) => r.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Persistence Info & Filter Bar */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Analysis History & Persistent Reports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <span>
                Persisted locally via <code className="font-mono text-slate-300">{storageEngine}</code>{' '}
                (PostgreSQL-compatible relational repository abstraction).
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <label className="relative block">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, text, comment type, aspect..."
              className="w-full pl-8 pr-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500"
            />
          </label>

          <select
            aria-label="Filter history by sentiment"
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
          >
            <option value="All">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Negative">Negative</option>
            <option value="Mixed">Mixed</option>
            <option value="Neutral">Neutral</option>
          </select>

          <input
            type="date"
            aria-label="Filter history by date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
          />
        </div>
      </section>

      {/* History Table */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading analysis history...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-white text-sm">No Matching History Records</p>
            <p>
              Run a statement, batch, or conversation analysis to store persistent results here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-3 px-6 whitespace-nowrap">Analysis ID</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date & Time</th>
                  <th className="py-3 px-4">Original Input</th>
                  <th className="py-3 px-4 whitespace-nowrap">Sentiment</th>
                  <th className="py-3 px-4 whitespace-nowrap">Comment Type · Main Aspects</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#11192D]">
                    <td className="py-3.5 px-6 font-mono text-slate-300 whitespace-nowrap align-top">
                      {rec.id}
                      <span className="block text-[11px] font-sans text-slate-500">
                        {rec.sourceType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap tabular-nums align-top">
                      {new Date(rec.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-100 max-w-sm align-top">
                      <p className="line-clamp-2 leading-relaxed">{rec.inputPreview}</p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      <SentimentLabel polarity={rec.overallSentiment} />
                    </td>
                    <td className="py-3.5 px-4 align-top space-y-0.5 max-w-xs">
                      <p className="font-medium text-slate-200 truncate">
                        {rec.commentTypes.join(', ')}
                      </p>
                      <p className="text-slate-400 truncate">
                        {rec.mainAspects.length > 0 ? rec.mainAspects.join(', ') : 'No aspects'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-emerald-400 font-medium align-top">
                      {rec.status}
                    </td>
                    <td className="py-3.5 px-6 text-right whitespace-nowrap align-top">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReopen(rec.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-md"
                          title="Reopen result"
                        >
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          <span>Open</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExport(rec.id)}
                          className="p-1.5 text-slate-300 hover:text-white bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-md"
                          title="Export report"
                          aria-label={`Export ${rec.id}`}
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(rec.id)}
                          className="p-1.5 text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-md"
                          title="Delete record"
                          aria-label={`Delete ${rec.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Prediction Feedback Log */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800/80">
          <h3 className="font-display text-sm font-semibold text-white">
            Dataset Review & Prediction Feedback Log ({feedbackRows.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            User-flagged predictions retained for future dataset curation (not automatically
            treated as verified training data).
          </p>
        </div>

        {feedbackRows.length === 0 ? (
          <div className="p-6 text-xs text-slate-400">No user feedback flags recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-6">Feedback ID</th>
                  <th className="py-2.5 px-4">Statement</th>
                  <th className="py-2.5 px-4">Predicted</th>
                  <th className="py-2.5 px-4">Verdict</th>
                  <th className="py-2.5 px-6">Reviewer Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {feedbackRows.map((fb) => (
                  <tr key={fb.id}>
                    <td className="py-3 px-6 font-mono text-slate-400 whitespace-nowrap">
                      {fb.id}
                    </td>
                    <td className="py-3 px-4 text-slate-200 max-w-sm truncate">{fb.inputText}</td>
                    <td className="py-3 px-4 text-slate-300">{fb.predictedSentiment}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-medium">
                      <span className={fb.isCorrect ? 'text-emerald-400' : 'text-rose-400'}>
                        {fb.isCorrect ? 'Accurate' : 'Flagged Incorrect'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-400">{fb.notes ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
