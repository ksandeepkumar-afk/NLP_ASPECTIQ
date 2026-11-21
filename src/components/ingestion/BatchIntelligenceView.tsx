import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { OPTIONAL_BATCH_EXAMPLES } from '../../data/sampleDataset';
import {
  buildCsvDatasetPreview,
  parseCsvFileToDocument,
  parseManualBatchInput,
} from '../../services/csvParser';
import {
  analyzeBatchProgressive,
  discoverTopicClusters,
  searchSemanticStatements,
} from '../../services/modelAdapter';
import {
  downloadCsvIngestionTemplate,
  exportFailedRowsCsv,
  exportPredictionsCsv,
  exportSummaryReportCsv,
  exportSummaryReportJson,
} from '../../services/reportExport';
import {
  BatchAnalysisResult,
  CsvDatasetPreview,
  OverallSentiment,
  ParsedCsvDocument,
  SemanticSearchMatch,
  TopicClusterResult,
} from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';
import { SpanHighlightedText } from '../common/SpanHighlightedText';

interface BatchIntelligenceViewProps {
  activeBatch: BatchAnalysisResult | null;
  onBatchCleared: () => void;
  onBatchAnalyzed: (result: BatchAnalysisResult) => void;
  draftManualText?: string;
  onDraftManualTextChange?: (text: string) => void;
  savedParsedDoc?: ParsedCsvDocument | null;
  onSavedParsedDocChange?: (doc: ParsedCsvDocument | null) => void;
}

const PAGE_SIZE = 20;

export function BatchIntelligenceView({
  activeBatch,
  onBatchCleared,
  onBatchAnalyzed,
  draftManualText,
  onDraftManualTextChange,
  savedParsedDoc,
  onSavedParsedDocChange,
}: BatchIntelligenceViewProps) {
  const [inputMode, setInputMode] = useState<'csv' | 'paste'>('csv');
  const [internalManualText, setInternalManualText] = useState('');
  const [excludeManualDuplicates, setExcludeManualDuplicates] = useState(true);

  const manualBatchText =
    draftManualText !== undefined ? draftManualText : internalManualText;
  const setManualBatchText = (val: string) => {
    if (onDraftManualTextChange) onDraftManualTextChange(val);
    else setInternalManualText(val);
  };

  const [internalParsedDoc, setInternalParsedDoc] = useState<ParsedCsvDocument | null>(null);
  const parsedDoc = savedParsedDoc !== undefined ? savedParsedDoc : internalParsedDoc;
  const setParsedDoc = (doc: ParsedCsvDocument | null) => {
    if (onSavedParsedDocChange) onSavedParsedDocChange(doc);
    else setInternalParsedDoc(doc);
  };

  const [selectedColumn, setSelectedColumn] = useState<string | null>(
    parsedDoc?.selectedColumn ?? null
  );
  const [speakerColumn, setSpeakerColumn] = useState<string | null>(
    parsedDoc?.speakerColumn ?? null
  );
  const [timestampColumn, setTimestampColumn] = useState<string | null>(
    parsedDoc?.timestampColumn ?? null
  );
  const [excludeCsvDuplicates, setExcludeCsvDuplicates] = useState(true);
  const [isParsing, setIsParsing] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Batch Results Filtering, Sorting & Pagination
  const [sentimentFilter, setSentimentFilter] = useState<'All' | OverallSentiment>('All');
  const [commentTypeFilter, setCommentTypeFilter] = useState<string>('All');
  const [emotionFilter, setEmotionFilter] = useState<string>('All');
  const [toneFilter, setToneFilter] = useState<string>('All');
  const [aspectFilter, setAspectFilter] = useState<string>('All');
  const [keywordQuery, setKeywordQuery] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'sentiment' | 'aspects'>('order');
  const [page, setPage] = useState(1);

  // Semantic Search & Topic Discovery state
  const [semanticQuery, setSemanticQuery] = useState('');
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);
  const [semanticMatches, setSemanticMatches] = useState<SemanticSearchMatch[] | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  const [isClusteringTopics, setIsClusteringTopics] = useState(false);
  const [topicClusters, setTopicClusters] = useState<TopicClusterResult[] | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);

  const manualParsed = useMemo(() => parseManualBatchInput(manualBatchText), [manualBatchText]);
  const manualRowsReady = useMemo(
    () =>
      manualParsed.rows.filter(
        (r) => r.isValid || (r.isDuplicate && !excludeManualDuplicates)
      ),
    [manualParsed.rows, excludeManualDuplicates]
  );

  const preview: CsvDatasetPreview | null = useMemo(() => {
    if (!parsedDoc) return null;
    return buildCsvDatasetPreview(parsedDoc, selectedColumn, speakerColumn, timestampColumn);
  }, [parsedDoc, selectedColumn, speakerColumn, timestampColumn]);

  const csvRowsReady = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter(
      (r) => r.isValid || (r.isDuplicate && !excludeCsvDuplicates)
    );
  }, [preview, excludeCsvDuplicates]);

  const resetDownstreamExplore = () => {
    setSemanticMatches(null);
    setTopicClusters(null);
    setSemanticError(null);
    setTopicError(null);
    setPage(1);
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onBatchCleared();
    resetDownstreamExplore();
    setAnalysisError(null);
    setIsParsing(true);
    try {
      const doc = await parseCsvFileToDocument(file);
      setParsedDoc(doc);
      setSelectedColumn(doc.selectedColumn);
      setSpeakerColumn(doc.speakerColumn);
      setTimestampColumn(doc.timestampColumn);
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  const handleRunBatch = async (
    datasetName: string,
    inputMethod: 'csv_upload' | 'manual_batch',
    rows: typeof csvRowsReady
  ) => {
    if (rows.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    resetDownstreamExplore();
    setProgress({ done: 0, total: rows.length });

    try {
      const resp = await analyzeBatchProgressive({
        datasetName,
        inputMethod,
        rows,
        onProgress: (done, total) => setProgress({ done, total }),
      });

      if (!resp.ok || !resp.batch) {
        setAnalysisError(resp.errorMessage ?? 'Batch analysis failed.');
        return;
      }

      onBatchAnalyzed(resp.batch);
    } finally {
      setIsAnalyzing(false);
      setProgress(null);
    }
  };

  const handleSemanticSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBatch || semanticQuery.trim().length < 2) return;
    setIsSearchingSemantic(true);
    setSemanticError(null);
    try {
      const resp = await searchSemanticStatements({
        query: semanticQuery.trim(),
        documents: activeBatch.results.map((r) => ({
          statementId: r.statementId,
          text: r.originalText,
          overallSentiment: r.overallSentiment,
        })),
        topK: 8,
      });
      if (!resp.ok) {
        setSemanticError(resp.errorMessage ?? 'Semantic search failed.');
        return;
      }
      setSemanticMatches(resp.matches);
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  const handleTopicClustering = async () => {
    if (!activeBatch) return;
    setIsClusteringTopics(true);
    setTopicError(null);
    try {
      const resp = await discoverTopicClusters(
        activeBatch.results.map((r) => ({
          statementId: r.statementId,
          text: r.originalText,
          overallSentiment: r.overallSentiment,
        }))
      );
      if (!resp.ok) {
        setTopicError(resp.errorMessage ?? 'Topic clustering failed.');
        return;
      }
      setTopicClusters(resp.clusters);
    } finally {
      setIsClusteringTopics(false);
    }
  };

  const filteredAndSortedRows = useMemo(() => {
    if (!activeBatch) return [];
    const q = keywordQuery.trim().toLowerCase();

    const filtered = activeBatch.results.filter((stmt) => {
      if (sentimentFilter !== 'All' && stmt.overallSentiment !== sentimentFilter) return false;
      if (commentTypeFilter !== 'All' && !stmt.commentTypes.includes(commentTypeFilter))
        return false;
      if (emotionFilter !== 'All' && stmt.emotion !== emotionFilter) return false;
      if (toneFilter !== 'All' && stmt.tone !== toneFilter) return false;
      if (
        aspectFilter !== 'All' &&
        !stmt.aspects.some((a) => a.aspectCategory === aspectFilter)
      ) {
        return false;
      }
      if (q) {
        const hit =
          stmt.originalText.toLowerCase().includes(q) ||
          stmt.statementId.toLowerCase().includes(q) ||
          (stmt.speaker && stmt.speaker.toLowerCase().includes(q)) ||
          stmt.aspects.some(
            (a) =>
              a.aspectCategory.toLowerCase().includes(q) ||
              (a.aspectTerm && a.aspectTerm.toLowerCase().includes(q))
          );
        if (!hit) return false;
      }
      return true;
    });

    if (sortBy === 'sentiment') {
      return [...filtered].sort((a, b) => a.overallSentiment.localeCompare(b.overallSentiment));
    }
    if (sortBy === 'aspects') {
      return [...filtered].sort((a, b) => b.aspects.length - a.aspects.length);
    }
    return filtered;
  }, [
    activeBatch,
    sentimentFilter,
    commentTypeFilter,
    emotionFilter,
    toneFilter,
    aspectFilter,
    keywordQuery,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredAndSortedRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* Ingestion Card */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Batch Intelligence & Dataset Ingestion
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload CSV files (reviews, comments, messages, feedback) or paste multiple
              statements. Processes rows in controlled backend chunks with progress reporting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-1 bg-[#131B2E] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMode('csv')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  inputMode === 'csv'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                CSV Upload
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  inputMode === 'paste'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Paste Statements
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setInputMode('paste');
                setManualBatchText(OPTIONAL_BATCH_EXAMPLES.join('\n'));
                setAnalysisError(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Load Example Batch</span>
            </button>

            <button
              type="button"
              onClick={downloadCsvIngestionTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>CSV Template</span>
            </button>
          </div>
        </div>

        {inputMode === 'csv' ? (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-blue-500 rounded-lg py-8 px-6 cursor-pointer transition-colors bg-[#131B2E]/60">
              <Upload className="w-5 h-5 text-slate-400 mb-2" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-100">
                {isParsing ? 'Parsing CSV...' : 'Choose a UTF-8 .csv file'}
              </span>
              <span className="text-xs text-slate-400 mt-1">
                Auto-detects text, ID, speaker, and timestamp columns (max 5 MB, 500 rows/batch)
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelected}
                disabled={isParsing || isAnalyzing}
                className="sr-only"
              />
            </label>

            {preview && preview.fatalError && (
              <div
                role="alert"
                className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-200 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
                <p>{preview.fatalError}</p>
              </div>
            )}

            {preview && !preview.fatalError && (
              <div className="space-y-4 pt-2 border-t border-slate-800/80">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-300">
                      Input Text Column {preview.autoDetected ? '(Auto-detected)' : ''}
                    </span>
                    <select
                      value={selectedColumn ?? ''}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        setSelectedColumn(next);
                        if (parsedDoc) {
                          setParsedDoc({ ...parsedDoc, selectedColumn: next });
                        }
                        onBatchCleared();
                      }}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">-- Select text column --</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="font-medium text-slate-300">Speaker Column (Optional)</span>
                    <select
                      value={speakerColumn ?? ''}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        setSpeakerColumn(next);
                        if (parsedDoc) {
                          setParsedDoc({ ...parsedDoc, speakerColumn: next });
                        }
                      }}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">None</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-1">
                    <span className="font-medium text-slate-300">
                      Date / Timestamp Column (Optional)
                    </span>
                    <select
                      value={timestampColumn ?? ''}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        setTimestampColumn(next);
                        if (parsedDoc) {
                          setParsedDoc({ ...parsedDoc, timestampColumn: next });
                        }
                      }}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">None</option>
                      {preview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-mono text-slate-400 tabular-nums">
                      {preview.totalRows} total · {preview.validRows} valid ·{' '}
                      {preview.duplicateRows} duplicates · {preview.invalidRows} invalid
                    </span>
                    {preview.duplicateRows > 0 && (
                      <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeCsvDuplicates}
                          onChange={(e) => setExcludeCsvDuplicates(e.target.checked)}
                          className="rounded border-slate-700 bg-[#131B2E] text-blue-500"
                        />
                        <span>Skip duplicates</span>
                      </label>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzing || !preview.selectedColumn || csvRowsReady.length === 0}
                    onClick={() =>
                      handleRunBatch(preview.fileName, 'csv_upload', csvRowsReady)
                    }
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {isAnalyzing
                        ? 'Processing Batch...'
                        : `Analyze ${csvRowsReady.length} Records`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              rows={6}
              value={manualBatchText}
              onChange={(e) => {
                setManualBatchText(e.target.value);
                setAnalysisError(null);
              }}
              placeholder="Paste multiple statements, comments, or feedback (one per line)..."
              className="w-full px-4 py-3 text-sm text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-4">
                <span className="font-mono text-slate-400 tabular-nums">
                  {manualRowsReady.length} valid statements ready
                </span>
                {manualParsed.duplicateCount > 0 && (
                  <label className="inline-flex items-center gap-1.5 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeManualDuplicates}
                      onChange={(e) => setExcludeManualDuplicates(e.target.checked)}
                      className="rounded border-slate-700 bg-[#131B2E] text-blue-500"
                    />
                    <span>Skip duplicates ({manualParsed.duplicateCount})</span>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setManualBatchText('');
                    onBatchCleared();
                    resetDownstreamExplore();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  disabled={isAnalyzing || manualRowsReady.length === 0}
                  onClick={() =>
                    handleRunBatch(
                      `Manual Batch (${manualRowsReady.length} records)`,
                      'manual_batch',
                      manualRowsReady
                    )
                  }
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {isAnalyzing
                      ? 'Processing Batch...'
                      : `Analyze ${manualRowsReady.length} Statements`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Progress Indicator */}
        {isAnalyzing && progress && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-300 tabular-nums">
              <span>Processing records in controlled chunks...</span>
              <span className="font-mono">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-2 w-full bg-[#131B2E] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-200"
                style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {analysisError && (
          <div
            role="alert"
            className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-lg text-xs text-rose-200 flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p>{analysisError}</p>
          </div>
        )}
      </section>

      {/* Empty State */}
      {!activeBatch && !isAnalyzing && (
        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-10 text-center space-y-2">
          <FileSpreadsheet className="w-6 h-6 text-slate-500 mx-auto" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white">No Batch Dataset Analyzed Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Upload a CSV or paste multiple statements above to view batch intelligence metrics,
            semantic search, topic clustering, and downloadable reports.
          </p>
        </section>
      )}

      {/* Active Batch Results */}
      {activeBatch && (
        <div className="space-y-6">
          {/* Batch Metrics & Export Strip */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  {activeBatch.datasetName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {activeBatch.totalSubmitted} total records ·{' '}
                  {activeBatch.totalStatementsAnalyzed} succeeded · {activeBatch.failedCount}{' '}
                  failed · {activeBatch.processingTimeMs} ms
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportPredictionsCsv(activeBatch)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Results CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportSummaryReportCsv(activeBatch)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Summary CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportSummaryReportJson(activeBatch)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>JSON</span>
                </button>
                {activeBatch.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      exportFailedRowsCsv(activeBatch.datasetName, activeBatch.failedRows)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <span>Error Report ({activeBatch.failedCount})</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs pt-2 border-t border-slate-800/80">
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Positive</span>
                <span className="font-mono text-base font-semibold text-emerald-400 tabular-nums">
                  {activeBatch.sentimentCounts.Positive}
                </span>
              </div>
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Negative</span>
                <span className="font-mono text-base font-semibold text-rose-400 tabular-nums">
                  {activeBatch.sentimentCounts.Negative}
                </span>
              </div>
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Mixed</span>
                <span className="font-mono text-base font-semibold text-amber-400 tabular-nums">
                  {activeBatch.sentimentCounts.Mixed}
                </span>
              </div>
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Neutral</span>
                <span className="font-mono text-base font-semibold text-slate-300 tabular-nums">
                  {activeBatch.sentimentCounts.Neutral}
                </span>
              </div>
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Aspects Extracted</span>
                <span className="font-mono text-base font-semibold text-white tabular-nums">
                  {activeBatch.totalAspectsExtracted}
                </span>
              </div>
              <div className="p-3 bg-[#131B2E] border border-slate-800 rounded-lg">
                <span className="text-slate-400 block">Top Emotion</span>
                <span className="font-semibold text-white truncate block">
                  {activeBatch.emotionSummary[0]?.label ?? '--'}
                </span>
              </div>
            </div>
          </section>

          {/* Semantic Search & Topic Discovery */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Semantic Search */}
            <section className="lg:col-span-6 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <div className="pb-3 border-b border-slate-800/80">
                <h3 className="font-display text-base font-semibold text-white">
                  Semantic Search (Concept Matching)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Uses dense embeddings (<code className="font-mono text-slate-300">gemini-embedding-2</code>)
                  + cosine similarity to retrieve conceptually related statements without exact
                  keyword overlap.
                </p>
              </div>

              <form onSubmit={handleSemanticSearch} className="flex gap-2">
                <input
                  type="text"
                  value={semanticQuery}
                  onChange={(e) => setSemanticQuery(e.target.value)}
                  placeholder='e.g. "Poor battery performance"'
                  className="flex-1 px-3 py-2 text-xs text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={isSearchingSemantic || semanticQuery.trim().length < 2}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {isSearchingSemantic ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>Search</span>
                </button>
              </form>

              {semanticError && <p className="text-xs text-rose-400">{semanticError}</p>}

              {semanticMatches && (
                <ul className="divide-y divide-slate-800/70 text-xs max-h-72 overflow-y-auto">
                  {semanticMatches.map((m) => (
                    <li key={m.statementId} className="py-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-400">{m.statementId}</span>
                        <div className="flex items-center gap-2">
                          <SentimentLabel polarity={m.overallSentiment} />
                          <span className="font-mono text-blue-400 tabular-nums">
                            sim {(m.similarityScore * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-200 leading-relaxed">{m.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Topic Clustering */}
            <section className="lg:col-span-6 bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Topic Discovery & Clustering
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Groups statements via cosine k-means clustering over embeddings. Labels are
                    approximate exploratory groupings.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isClusteringTopics || activeBatch.results.length < 3}
                  onClick={handleTopicClustering}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {isClusteringTopics ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>{isClusteringTopics ? 'Clustering...' : 'Cluster Topics'}</span>
                </button>
              </div>

              {topicError && <p className="text-xs text-rose-400">{topicError}</p>}

              {topicClusters && (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {topicClusters.map((c) => (
                    <div
                      key={c.clusterId}
                      className="p-3.5 bg-[#131B2E] border border-slate-800 rounded-lg space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          {c.approximateLabel} (Approximate)
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {c.statementCount} statements
                        </span>
                      </div>
                      <p className="text-slate-400 tabular-nums">
                        +{c.sentimentDistribution.Positive} Positive ·{' '}
                        {c.sentimentDistribution.Negative} Negative ·{' '}
                        {c.sentimentDistribution.Mixed} Mixed ·{' '}
                        {c.sentimentDistribution.Neutral} Neutral
                      </p>
                      <ul className="space-y-1 text-slate-300">
                        {c.representativeExamples.map((ex) => (
                          <li key={ex.statementId} className="truncate">
                            &ldquo;{ex.text}&rdquo;
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Filterable, Sortable, Paginated Batch Table */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Processed Records ({filteredAndSortedRows.length})
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    Page {safePage} of {totalPages}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <select
                    aria-label="Sort results"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'order' | 'sentiment' | 'aspects')}
                    className="px-3 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                  >
                    <option value="order">Sort: Original Order</option>
                    <option value="sentiment">Sort: Sentiment</option>
                    <option value="aspects">Sort: Most Aspects</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
                <input
                  type="search"
                  value={keywordQuery}
                  onChange={(e) => {
                    setKeywordQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Keyword search..."
                  className="px-3 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500"
                />

                <select
                  aria-label="Filter by Sentiment"
                  value={sentimentFilter}
                  onChange={(e) => {
                    setSentimentFilter(e.target.value as 'All' | OverallSentiment);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                >
                  <option value="All">All Sentiments</option>
                  <option value="Positive">Positive</option>
                  <option value="Negative">Negative</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Neutral">Neutral</option>
                </select>

                <select
                  aria-label="Filter by Comment Type"
                  value={commentTypeFilter}
                  onChange={(e) => {
                    setCommentTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                >
                  <option value="All">All Comment Types</option>
                  {activeBatch.commentTypeSummary.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Emotion"
                  value={emotionFilter}
                  onChange={(e) => {
                    setEmotionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                >
                  <option value="All">All Emotions</option>
                  {activeBatch.emotionSummary.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Tone"
                  value={toneFilter}
                  onChange={(e) => {
                    setToneFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                >
                  <option value="All">All Tones</option>
                  {activeBatch.toneSummary.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by Aspect"
                  value={aspectFilter}
                  onChange={(e) => {
                    setAspectFilter(e.target.value);
                    setPage(1);
                  }}
                  className="px-2.5 py-1.5 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                >
                  <option value="All">All Aspects</option>
                  {activeBatch.aspectSummary.map((item) => (
                    <option key={item.aspectCategory} value={item.aspectCategory}>
                      {item.aspectCategory} ({item.totalMentions})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-3 px-6 whitespace-nowrap">ID</th>
                    <th className="py-3 px-4">Statement</th>
                    <th className="py-3 px-4 whitespace-nowrap">Sentiment</th>
                    <th className="py-3 px-4 whitespace-nowrap">Comment · Tone · Emotion</th>
                    <th className="py-3 px-6">Aspects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {pagedRows.map((stmt) => (
                    <tr key={stmt.statementId} className="hover:bg-[#11192D]">
                      <td className="py-3.5 px-6 font-mono text-slate-400 whitespace-nowrap align-top">
                        {stmt.statementId}
                        {stmt.speaker && (
                          <span className="block text-slate-500 font-sans">{stmt.speaker}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-md align-top space-y-1">
                        <p className="text-slate-100 leading-relaxed">
                          <SpanHighlightedText text={stmt.originalText} aspects={stmt.aspects} />
                        </p>
                        <p className="text-slate-400">{stmt.insights.interpretation}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <SentimentLabel polarity={stmt.overallSentiment} />
                      </td>
                      <td className="py-3.5 px-4 align-top space-y-0.5">
                        <p className="font-medium text-slate-200">{stmt.commentTypes.join(', ')}</p>
                        <p className="text-slate-400">
                          {stmt.tone} · {stmt.emotion}
                        </p>
                      </td>
                      <td className="py-3.5 px-6 align-top">
                        {stmt.aspects.length === 0 ? (
                          <span className="text-slate-500">None</span>
                        ) : (
                          <ul className="space-y-1">
                            {stmt.aspects.map((a) => (
                              <li key={a.id} className="flex items-center gap-1.5 whitespace-nowrap">
                                <span className="font-medium text-slate-200">
                                  {a.aspectCategory}
                                </span>
                                <span className="text-slate-500" aria-hidden="true">
                                  —
                                </span>
                                <SentimentLabel polarity={a.sentiment} />
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 disabled:opacity-40 rounded-md"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Previous</span>
                </button>
                <span className="font-mono text-slate-400 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 disabled:opacity-40 rounded-md"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
