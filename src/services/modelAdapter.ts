import {
  BatchAnalysisResult,
  BatchRowError,
  ConversationAnalysisResult,
  ConversationMessageInput,
  HistorySummaryRecord,
  OverallSentiment,
  PredictionFeedbackRecord,
  RawStatementInputRow,
  SemanticSearchMatch,
  SingleAnalyzeResponse,
  StatementAnalysisOutput,
  StoredBatchSummary,
  StoredEvaluationRecord,
  TopicClusterResult,
} from '../types/absa';

export interface BackendHealthStatus {
  status: string;
  inferenceReady: boolean;
  embeddingsReady: boolean;
  providerName: string;
  isApiBased: boolean;
  storageEngine: string;
  privacyNotice: string;
}

export async function fetchBackendHealth(): Promise<BackendHealthStatus | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return (await res.json()) as BackendHealthStatus;
  } catch {
    return null;
  }
}

export async function analyzeSingleStatement(text: string): Promise<SingleAnalyzeResponse> {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const payload = (await response.json()) as SingleAnalyzeResponse;
    if (!response.ok || !payload.ok || !payload.result) {
      return {
        ok: false,
        errorCode: payload.errorCode ?? 'UPSTREAM_ERROR',
        errorMessage: payload.errorMessage ?? `Analysis failed with HTTP ${response.status}.`,
      };
    }

    return payload;
  } catch (error) {
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      errorMessage:
        error instanceof Error
          ? `Failed to connect to analysis backend: ${error.message}`
          : 'Network error connecting to analysis backend.',
    };
  }
}

/**
 * Processes batch datasets via controlled server chunks with live progress reporting
 * and finalizes aggregations + persistent storage.
 */
export async function analyzeBatchProgressive(params: {
  datasetName: string;
  inputMethod: 'csv_upload' | 'manual_batch';
  rows: RawStatementInputRow[];
  onProgress?: (completed: number, total: number) => void;
}): Promise<{ ok: boolean; batch: BatchAnalysisResult | null; errorMessage: string | null }> {
  if (params.rows.length === 0) {
    return { ok: false, batch: null, errorMessage: 'No valid rows provided.' };
  }

  const CHUNK_SIZE = 10;
  const startedAt = performance.now();
  const collectedResults: StatementAnalysisOutput[] = [];
  const collectedErrors: BatchRowError[] = [];

  for (let i = 0; i < params.rows.length; i += CHUNK_SIZE) {
    const slice = params.rows.slice(i, i + CHUNK_SIZE);
    try {
      const resp = await fetch('/api/analyze/batch/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: slice.map((r) => ({
            statementId: r.statementId,
            text: r.text,
            speaker: r.speaker,
            timestamp: r.timestamp,
          })),
        }),
      });

      const chunkData = (await resp.json()) as {
        ok?: boolean;
        errorCode?: string;
        errorMessage?: string;
        results?: StatementAnalysisOutput[];
        failedRows?: BatchRowError[];
      };

      if (resp.status === 503) {
        return {
          ok: false,
          batch: null,
          errorMessage: chunkData.errorMessage ?? 'Server inference credentials missing.',
        };
      }

      if (Array.isArray(chunkData.results)) {
        collectedResults.push(...chunkData.results);
      }
      if (Array.isArray(chunkData.failedRows)) {
        collectedErrors.push(...chunkData.failedRows);
      } else if (!resp.ok) {
        for (const r of slice) {
          collectedErrors.push({
            statementId: r.statementId,
            text: r.text,
            error: chunkData.errorMessage ?? `HTTP ${resp.status}`,
          });
        }
      }
    } catch (err) {
      for (const r of slice) {
        collectedErrors.push({
          statementId: r.statementId,
          text: r.text,
          error: err instanceof Error ? err.message : 'Network error',
        });
      }
    }

    params.onProgress?.(Math.min(i + slice.length, params.rows.length), params.rows.length);
  }

  if (collectedResults.length === 0 && collectedErrors.length > 0) {
    return {
      ok: false,
      batch: null,
      errorMessage: collectedErrors[0].error || 'All rows failed during batch processing.',
    };
  }

  try {
    const processingTimeMs = Number((performance.now() - startedAt).toFixed(2));
    const finalizeResp = await fetch('/api/analyze/batch/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        datasetName: params.datasetName,
        inputMethod: params.inputMethod,
        totalSubmitted: params.rows.length,
        processingTimeMs,
        results: collectedResults,
        failedRows: collectedErrors,
      }),
    });

    const batchPayload = (await finalizeResp.json()) as BatchAnalysisResult & {
      errorMessage?: string;
    };
    if (!finalizeResp.ok || !batchPayload.ok) {
      return {
        ok: false,
        batch: null,
        errorMessage: batchPayload.errorMessage ?? 'Failed to finalize batch report.',
      };
    }

    return { ok: true, batch: batchPayload, errorMessage: null };
  } catch (err) {
    return {
      ok: false,
      batch: null,
      errorMessage: err instanceof Error ? err.message : 'Network error finalizing batch.',
    };
  }
}

export async function analyzeConversation(params: {
  title: string;
  messages: ConversationMessageInput[];
}): Promise<{
  ok: boolean;
  conversation: ConversationAnalysisResult | null;
  errorMessage: string | null;
}> {
  try {
    const resp = await fetch('/api/conversation/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      conversation?: ConversationAnalysisResult;
      errorMessage?: string;
    };
    if (!resp.ok || !data.ok || !data.conversation) {
      return {
        ok: false,
        conversation: null,
        errorMessage: data.errorMessage ?? `Conversation analysis failed (HTTP ${resp.status}).`,
      };
    }
    return { ok: true, conversation: data.conversation, errorMessage: null };
  } catch (err) {
    return {
      ok: false,
      conversation: null,
      errorMessage: err instanceof Error ? err.message : 'Network error analyzing conversation.',
    };
  }
}

export async function searchSemanticStatements(params: {
  query: string;
  documents: Array<{ statementId: string; text: string; overallSentiment: OverallSentiment }>;
  topK?: number;
}): Promise<{
  ok: boolean;
  embeddingModel?: string;
  matches: SemanticSearchMatch[];
  errorMessage: string | null;
}> {
  try {
    const resp = await fetch('/api/semantic/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      embeddingModel?: string;
      matches?: SemanticSearchMatch[];
      errorMessage?: string;
    };
    if (!resp.ok || !data.ok) {
      return {
        ok: false,
        matches: [],
        errorMessage: data.errorMessage ?? 'Semantic search failed.',
      };
    }
    return {
      ok: true,
      embeddingModel: data.embeddingModel,
      matches: data.matches ?? [],
      errorMessage: null,
    };
  } catch (err) {
    return {
      ok: false,
      matches: [],
      errorMessage: err instanceof Error ? err.message : 'Network error during semantic search.',
    };
  }
}

export async function discoverTopicClusters(
  documents: Array<{ statementId: string; text: string; overallSentiment: OverallSentiment }>
): Promise<{
  ok: boolean;
  embeddingModel?: string;
  clusters: TopicClusterResult[];
  errorMessage: string | null;
}> {
  try {
    const resp = await fetch('/api/semantic/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents }),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      embeddingModel?: string;
      clusters?: TopicClusterResult[];
      errorMessage?: string;
    };
    if (!resp.ok || !data.ok) {
      return {
        ok: false,
        clusters: [],
        errorMessage: data.errorMessage ?? 'Topic clustering failed.',
      };
    }
    return {
      ok: true,
      embeddingModel: data.embeddingModel,
      clusters: data.clusters ?? [],
      errorMessage: null,
    };
  } catch (err) {
    return {
      ok: false,
      clusters: [],
      errorMessage: err instanceof Error ? err.message : 'Network error during topic clustering.',
    };
  }
}

export async function fetchHistory(filters?: {
  search?: string;
  sentiment?: string;
  date?: string;
}): Promise<{ records: HistorySummaryRecord[]; storageEngine: string }> {
  const qs = new URLSearchParams();
  if (filters?.search) qs.set('search', filters.search);
  if (filters?.sentiment && filters.sentiment !== 'All') qs.set('sentiment', filters.sentiment);
  if (filters?.date) qs.set('date', filters.date);

  const resp = await fetch(`/api/history?${qs.toString()}`);
  if (!resp.ok) return { records: [], storageEngine: 'SQLite' };
  const data = (await resp.json()) as {
    records?: HistorySummaryRecord[];
    storageEngine?: string;
  };
  return {
    records: data.records ?? [],
    storageEngine: data.storageEngine ?? 'SQLite',
  };
}

export async function fetchHistoryRecord(id: string): Promise<{
  sourceType: 'statement' | 'batch' | 'conversation';
  payload: unknown;
} | null> {
  const resp = await fetch(`/api/history/${encodeURIComponent(id)}`);
  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    ok?: boolean;
    sourceType?: 'statement' | 'batch' | 'conversation';
    payload?: unknown;
  };
  if (!data.ok || !data.sourceType) return null;
  return { sourceType: data.sourceType, payload: data.payload };
}

export async function deleteHistoryRecord(id: string): Promise<boolean> {
  const resp = await fetch(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return resp.ok;
}

export async function submitPredictionFeedback(params: {
  analysisId: string;
  inputText: string;
  predictedSentiment: string;
  isCorrect: boolean;
  reportedIssue?: string | null;
  notes?: string | null;
}): Promise<{ ok: boolean; record?: PredictionFeedbackRecord }> {
  const resp = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!resp.ok) return { ok: false };
  return (await resp.json()) as { ok: boolean; record: PredictionFeedbackRecord };
}

export async function fetchPredictionFeedback(): Promise<PredictionFeedbackRecord[]> {
  const resp = await fetch('/api/feedback');
  if (!resp.ok) return [];
  const data = (await resp.json()) as { records?: PredictionFeedbackRecord[] };
  return data.records ?? [];
}

export async function fetchStoredBatchAnalytics(): Promise<StoredBatchSummary[]> {
  const resp = await fetch('/api/analytics/batches');
  if (!resp.ok) return [];
  const data = (await resp.json()) as { batches?: StoredBatchSummary[] };
  return data.batches ?? [];
}

export async function fetchEvaluationRuns(): Promise<StoredEvaluationRecord[]> {
  const resp = await fetch('/api/evaluation');
  if (!resp.ok) return [];
  const data = (await resp.json()) as { runs?: StoredEvaluationRecord[] };
  return data.runs ?? [];
}

export async function runLocalModelEvaluation(params: {
  datasetName: string;
  samples: Array<{ text: string; label: string }>;
  epochs?: number;
}): Promise<{ ok: boolean; record: StoredEvaluationRecord | null; errorMessage: string | null }> {
  try {
    const resp = await fetch('/api/evaluation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = (await resp.json()) as {
      ok?: boolean;
      record?: StoredEvaluationRecord;
      errorMessage?: string;
    };
    if (!resp.ok || !data.ok || !data.record) {
      return {
        ok: false,
        record: null,
        errorMessage: data.errorMessage ?? 'Evaluation failed.',
      };
    }
    return { ok: true, record: data.record, errorMessage: null };
  } catch (err) {
    return {
      ok: false,
      record: null,
      errorMessage: err instanceof Error ? err.message : 'Network error running evaluation.',
    };
  }
}
