import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  Loader2,
  MessageSquare,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react';
import { OPTIONAL_CONVERSATION_EXAMPLE } from '../../data/sampleDataset';
import {
  buildCsvDatasetPreview,
  parseCsvFileToDocument,
  parsePastedConversation,
} from '../../services/csvParser';
import { analyzeConversation } from '../../services/modelAdapter';
import { exportConversationJson } from '../../services/reportExport';
import {
  ConversationAnalysisResult,
  ConversationMessageInput,
  ParsedCsvDocument,
} from '../../types/absa';
import { SentimentLabel } from '../common/SentimentLabel';

interface ConversationAnalyzerViewProps {
  activeConversation: ConversationAnalysisResult | null;
  onConversationAnalyzed: (result: ConversationAnalysisResult) => void;
  draftTitle?: string;
  onDraftTitleChange?: (title: string) => void;
  draftPastedText?: string;
  onDraftPastedTextChange?: (text: string) => void;
}

export function ConversationAnalyzerView({
  activeConversation,
  onConversationAnalyzed,
  draftTitle,
  onDraftTitleChange,
  draftPastedText,
  onDraftPastedTextChange,
}: ConversationAnalyzerViewProps) {
  const [inputMode, setInputMode] = useState<'paste' | 'csv'>('paste');
  const [internalTitle, setInternalTitle] = useState('Customer Support Thread');
  const [internalPastedText, setInternalPastedText] = useState('');

  const title = draftTitle !== undefined ? draftTitle : internalTitle;
  const setTitle = (val: string) => {
    if (onDraftTitleChange) onDraftTitleChange(val);
    else setInternalTitle(val);
  };

  const pastedText = draftPastedText !== undefined ? draftPastedText : internalPastedText;
  const setPastedText = (val: string) => {
    if (onDraftPastedTextChange) onDraftPastedTextChange(val);
    else setInternalPastedText(val);
  };

  // CSV state
  const [parsedDoc, setParsedDoc] = useState<ParsedCsvDocument | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [speakerColumn, setSpeakerColumn] = useState<string | null>(null);
  const [timestampColumn, setTimestampColumn] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMsgIdx, setSelectedMsgIdx] = useState<number | null>(null);

  const parsedPastedMessages = useMemo(
    () => parsePastedConversation(pastedText),
    [pastedText]
  );

  const csvPreview = useMemo(() => {
    if (!parsedDoc) return null;
    return buildCsvDatasetPreview(parsedDoc, selectedColumn, speakerColumn, timestampColumn);
  }, [parsedDoc, selectedColumn, speakerColumn, timestampColumn]);

  const csvMessages: ConversationMessageInput[] = useMemo(() => {
    if (!csvPreview) return [];
    return csvPreview.rows
      .filter((r) => r.text.length >= 2)
      .map((r) => ({
        messageId: r.statementId,
        speaker: r.speaker,
        timestamp: r.timestamp,
        text: r.text,
      }));
  }, [csvPreview]);

  const messagesToAnalyze = inputMode === 'paste' ? parsedPastedMessages : csvMessages;

  const handleCsvSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    const doc = await parseCsvFileToDocument(file);
    setParsedDoc(doc);
    setSelectedColumn(doc.selectedColumn);
    setSpeakerColumn(doc.speakerColumn);
    setTimestampColumn(doc.timestampColumn);
    setTitle(file.name.replace(/\.csv$/i, ''));
    event.target.value = '';
  };

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (messagesToAnalyze.length < 2) {
      setErrorMessage('Provide at least 2 chronological messages to analyze a conversation.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSelectedMsgIdx(null);

    try {
      const resp = await analyzeConversation({
        title: title.trim() || 'Conversation Analysis',
        messages: messagesToAnalyze,
      });
      if (!resp.ok || !resp.conversation) {
        setErrorMessage(resp.errorMessage ?? 'Conversation analysis failed.');
        return;
      }
      onConversationAnalyzed(resp.conversation);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const timelineGeometry = useMemo(() => {
    if (!activeConversation || activeConversation.messages.length === 0) return null;
    const width = 720;
    const height = 180;
    const padX = 36;
    const padY = 28;
    const n = activeConversation.messages.length;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;

    const points = activeConversation.messages.map((m, idx) => {
      const x = n === 1 ? width / 2 : padX + (idx / (n - 1)) * plotW;
      const y = padY + ((1 - m.sentimentTrendScore) / 2) * plotH;
      return { x, y, message: m };
    });

    const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    return { width, height, padX, padY, points, polyline };
  }, [activeConversation]);

  return (
    <div className="space-y-6">
      {/* Header & Input Card */}
      <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Chronological Conversation Analyzer
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Paste a multi-turn thread or upload a CSV of messages (with optional speaker and
              timestamp columns) to track sentiment shifts, topics, and disagreements.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-1 bg-[#131B2E] border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  inputMode === 'paste'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Paste Conversation
              </button>
              <button
                type="button"
                onClick={() => setInputMode('csv')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  inputMode === 'csv'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Upload Messages CSV
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setInputMode('paste');
                setPastedText(OPTIONAL_CONVERSATION_EXAMPLE);
                setErrorMessage(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Load Example Thread</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleRunAnalysis} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-1.5 text-xs">
              <span className="font-medium text-slate-300">Conversation Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            </label>
          </div>

          {inputMode === 'paste' ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">
                Messages (one per line; optional &ldquo;Speaker: message&rdquo; prefix)
              </span>
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Customer: My phone battery drains rapidly.&#10;Support: Let me help check your diagnostics..."
                className="w-full px-4 py-3 text-sm text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 leading-relaxed"
              />
            </label>
          ) : (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center border border-dashed border-slate-700 hover:border-blue-500 rounded-lg py-8 px-6 cursor-pointer transition-colors bg-[#131B2E]/60">
                <Upload className="w-5 h-5 text-slate-400 mb-2" aria-hidden="true" />
                <span className="text-xs font-medium text-slate-200">
                  Choose a conversation .csv file (preserves chronological row order)
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvSelected}
                  className="sr-only"
                />
              </label>

              {csvPreview && !csvPreview.fatalError && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-300">Message Text Column</span>
                    <select
                      value={selectedColumn ?? ''}
                      onChange={(e) => setSelectedColumn(e.target.value || null)}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">-- Select message column --</option>
                      {csvPreview.headers.map((h) => (
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
                      onChange={(e) => setSpeakerColumn(e.target.value || null)}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">None (Do not invent speakers)</option>
                      {csvPreview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="font-medium text-slate-300">Timestamp Column (Optional)</span>
                    <select
                      value={timestampColumn ?? ''}
                      onChange={(e) => setTimestampColumn(e.target.value || null)}
                      className="w-full px-3 py-2 text-slate-100 bg-[#131B2E] border border-slate-700/80 rounded-lg"
                    >
                      <option value="">None</option>
                      {csvPreview.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {messagesToAnalyze.length} chronological message
              {messagesToAnalyze.length === 1 ? '' : 's'} detected
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPastedText('');
                  setParsedDoc(null);
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Clear</span>
              </button>

              <button
                type="submit"
                disabled={isAnalyzing || messagesToAnalyze.length < 2}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{isAnalyzing ? 'Analyzing Thread...' : 'Analyze Conversation'}</span>
              </button>
            </div>
          </div>
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="p-4 rounded-lg border bg-rose-950/40 border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}
      </section>

      {/* Empty State */}
      {!activeConversation && !isAnalyzing && (
        <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-10 text-center space-y-2">
          <MessageSquare className="w-6 h-6 text-slate-500 mx-auto" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white">No Conversation Analyzed Yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Paste a dialogue or upload a messages CSV above to generate a sentiment timeline,
            topic breakdown, emotional tone shifts, and message-level classifications.
          </p>
        </section>
      )}

      {/* Results View */}
      {activeConversation && (
        <div className="space-y-6">
          {/* Summary & Disclaimer */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div>
                <h3 className="font-display text-base font-semibold text-white">
                  {activeConversation.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {activeConversation.totalMessages} messages ·{' '}
                  {activeConversation.hasExplicitSpeakers
                    ? 'Explicit speakers preserved'
                    : 'No speaker identities provided'}{' '}
                  · {activeConversation.processingTimeMs} ms
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportConversationJson(activeConversation)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#131B2E] hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Export Conversation JSON</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400">Overall Conversation Summary</p>
                <p className="text-slate-200 leading-relaxed">{activeConversation.overallSummary}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-400">Conversation-Wide Trend</p>
                <p className="text-slate-200 leading-relaxed">
                  {activeConversation.sentimentTrendSummary}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
              {activeConversation.disclaimer}
            </p>
          </section>

          {/* Conversation Sentiment Timeline Chart */}
          {timelineGeometry && (
            <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div>
                  <h3 className="font-display text-base font-semibold text-white">
                    Conversation Sentiment Timeline
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Chronological polarity trajectory (+1 Positive, 0 Neutral/Mixed, -1 Negative).
                    Click any point to inspect the message.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <svg
                  viewBox={`0 0 ${timelineGeometry.width} ${timelineGeometry.height}`}
                  className="w-full min-w-[480px] h-48"
                  role="img"
                  aria-label="Conversation sentiment timeline across messages"
                >
                  {/* Reference horizontal lines */}
                  <line
                    x1={timelineGeometry.padX}
                    y1={timelineGeometry.padY}
                    x2={timelineGeometry.width - timelineGeometry.padX}
                    y2={timelineGeometry.padY}
                    stroke="#1e293b"
                    strokeDasharray="4 4"
                  />
                  <line
                    x1={timelineGeometry.padX}
                    y1={timelineGeometry.height / 2}
                    x2={timelineGeometry.width - timelineGeometry.padX}
                    y2={timelineGeometry.height / 2}
                    stroke="#334155"
                  />
                  <line
                    x1={timelineGeometry.padX}
                    y1={timelineGeometry.height - timelineGeometry.padY}
                    x2={timelineGeometry.width - timelineGeometry.padX}
                    y2={timelineGeometry.height - timelineGeometry.padY}
                    stroke="#1e293b"
                    strokeDasharray="4 4"
                  />

                  <text x="4" y={timelineGeometry.padY + 4} className="fill-emerald-400 text-[10px]">
                    +1
                  </text>
                  <text x="8" y={timelineGeometry.height / 2 + 3} className="fill-slate-400 text-[10px]">
                    0
                  </text>
                  <text
                    x="5"
                    y={timelineGeometry.height - timelineGeometry.padY + 4}
                    className="fill-rose-400 text-[10px]"
                  >
                    -1
                  </text>

                  {/* Line connecting chronological points */}
                  {timelineGeometry.points.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth="2"
                      points={timelineGeometry.polyline}
                    />
                  )}

                  {/* Interactive Message Nodes */}
                  {timelineGeometry.points.map((pt) => {
                    const fill =
                      pt.message.sentiment === 'Positive'
                        ? '#34d399'
                        : pt.message.sentiment === 'Negative'
                        ? '#fb7185'
                        : pt.message.sentiment === 'Mixed'
                        ? '#fbbf24'
                        : '#94a3b8';
                    const isSelected = selectedMsgIdx === pt.message.index;
                    return (
                      <g
                        key={pt.message.messageId}
                        className="cursor-pointer"
                        onClick={() => setSelectedMsgIdx(pt.message.index)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 7 : 5}
                          fill={fill}
                          stroke="#0D1322"
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={timelineGeometry.height - 6}
                          textAnchor="middle"
                          className="fill-slate-400 text-[10px] font-mono"
                        >
                          #{pt.message.index}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {selectedMsgIdx !== null && (
                <div className="p-4 bg-[#131B2E] border border-slate-800 rounded-lg text-xs space-y-1">
                  {(() => {
                    const msg = activeConversation.messages.find(
                      (m) => m.index === selectedMsgIdx
                    );
                    if (!msg) return null;
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">
                            Message #{msg.index}
                            {msg.speaker ? ` · ${msg.speaker}` : ''}
                          </span>
                          <SentimentLabel polarity={msg.sentiment} />
                        </div>
                        <p className="text-slate-200 leading-relaxed">{msg.text}</p>
                        <p className="text-slate-400">
                          {msg.commentTypes.join(', ')} · Tone: {msg.tone} · Emotion: {msg.emotion}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </section>
          )}

          {/* Collective Insights Grid: Topics, Shifts, Subjects, Disagreements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-sm font-semibold text-white pb-2 border-b border-slate-800/80">
                Repeated Topics & Subjects
              </h3>
              {activeConversation.repeatedTopics.length > 0 && (
                <ul className="space-y-2 text-xs">
                  {activeConversation.repeatedTopics.map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-200">{t.topic}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-slate-400 tabular-nums">
                          {t.mentionCount}x
                        </span>
                        <SentimentLabel polarity={t.dominantSentiment} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80 text-xs">
                <div className="space-y-1">
                  <p className="font-medium text-emerald-400">Main Positive Subjects</p>
                  {activeConversation.mainPositiveSubjects.length === 0 ? (
                    <p className="text-slate-500">None highlighted</p>
                  ) : (
                    <ul className="space-y-1 text-slate-300">
                      {activeConversation.mainPositiveSubjects.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-rose-400">Main Negative Subjects</p>
                  {activeConversation.mainNegativeSubjects.length === 0 ? (
                    <p className="text-slate-500">None highlighted</p>
                  ) : (
                    <ul className="space-y-1 text-slate-300">
                      {activeConversation.mainNegativeSubjects.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl p-6 space-y-4">
              <h3 className="font-display text-sm font-semibold text-white pb-2 border-b border-slate-800/80">
                Tone Shifts & Potential Disagreements
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="font-medium text-slate-400 mb-1">Changes in Emotional Tone</p>
                  {activeConversation.emotionalToneShifts.length === 0 ? (
                    <p className="text-slate-500">No notable tone transitions recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-200 list-disc pl-4">
                      {activeConversation.emotionalToneShifts.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  <p className="font-medium text-slate-400 mb-1">Potential Points of Disagreement</p>
                  {activeConversation.disagreementPoints.length === 0 ? (
                    <p className="text-slate-500">No explicit disagreements identified.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-200 list-disc pl-4">
                      {activeConversation.disagreementPoints.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Message-Level Chronological Table */}
          <section className="bg-[#0D1322] border border-slate-800/90 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800/80">
              <h3 className="font-display text-base font-semibold text-white">
                Message-by-Message Breakdown
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131B2E] border-b border-slate-800 text-slate-400 font-medium">
                    <th className="py-3 px-6 whitespace-nowrap">#</th>
                    <th className="py-3 px-4 whitespace-nowrap">Speaker / Time</th>
                    <th className="py-3 px-4">Message</th>
                    <th className="py-3 px-4 whitespace-nowrap">Sentiment</th>
                    <th className="py-3 px-4 whitespace-nowrap">Comment Type · Tone · Emotion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {activeConversation.messages.map((m) => (
                    <tr key={m.messageId} className="hover:bg-[#11192D]">
                      <td className="py-3.5 px-6 font-mono text-slate-400 tabular-nums align-top">
                        {m.index}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <p className="font-medium text-slate-200">
                          {m.speaker ?? 'Unspecified'}
                        </p>
                        {m.timestamp && (
                          <p className="font-mono text-slate-500 text-[11px]">{m.timestamp}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-100 max-w-md align-top space-y-1">
                        <p className="leading-relaxed">{m.text}</p>
                        <p className="text-slate-400">{m.explanation}</p>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap align-top">
                        <SentimentLabel polarity={m.sentiment} />
                      </td>
                      <td className="py-3.5 px-4 align-top space-y-0.5">
                        <p className="font-medium text-slate-200">{m.commentTypes.join(', ')}</p>
                        <p className="text-slate-400">
                          Tone: {m.tone} · Emotion: {m.emotion}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
