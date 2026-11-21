import { Router } from 'express';
import { trainAndEvaluateTfidfLogisticRegression } from '../models/tfidfLogisticRegression.ts';
import { analyzeConversationMessages } from '../services/conversationService.ts';
import { defaultStatementProvider } from '../services/geminiNlpProvider.ts';
import type {
  BatchRowError,
  BatchStatementInput,
  ConversationMessageInput,
  OverallSentiment,
  StatementAnalysisOutput,
} from '../services/inferenceProvider.ts';
import { runSemanticSearch, runTopicClustering } from '../services/semanticService.ts';
import { historyDb } from '../storage/database.ts';

const MIN_STATEMENT_LENGTH = 2;
const MAX_STATEMENT_LENGTH = 4000;
const MAX_BATCH_ROWS = 500;
const MAX_CHUNK_ROWS = 20;
const MAX_CONVERSATION_MESSAGES = 120;

export function computeBatchAggregations(results: StatementAnalysisOutput[]) {
  const sentimentCounts: Record<OverallSentiment, number> = {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
    Mixed: 0,
  };

  const commentTypeCounts = new Map<string, number>();
  const toneCounts = new Map<string, number>();
  const emotionCounts = new Map<string, number>();
  const intentCounts = new Map<string, number>();
  const aspectMap = new Map<
    string,
    {
      aspectCategory: string;
      positiveCount: number;
      negativeCount: number;
      neutralCount: number;
      totalMentions: number;
    }
  >();

  let totalAspectsExtracted = 0;
  let sarcasmDetectedCount = 0;
  let negationCount = 0;

  for (const stmt of results) {
    sentimentCounts[stmt.overallSentiment] += 1;

    if (stmt.languageAnalysis.sarcasmOrIrony === 'Detected') {
      sarcasmDetectedCount += 1;
    }
    if (stmt.languageAnalysis.containsNegation) {
      negationCount += 1;
    }

    for (const cType of stmt.commentTypes) {
      commentTypeCounts.set(cType, (commentTypeCounts.get(cType) ?? 0) + 1);
    }

    toneCounts.set(stmt.tone, (toneCounts.get(stmt.tone) ?? 0) + 1);
    emotionCounts.set(stmt.emotion, (emotionCounts.get(stmt.emotion) ?? 0) + 1);
    intentCounts.set(
      stmt.communicationIntent,
      (intentCounts.get(stmt.communicationIntent) ?? 0) + 1
    );

    for (const asp of stmt.aspects) {
      totalAspectsExtracted += 1;
      const entry = aspectMap.get(asp.aspectCategory) ?? {
        aspectCategory: asp.aspectCategory,
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        totalMentions: 0,
      };
      if (asp.sentiment === 'Positive') entry.positiveCount += 1;
      if (asp.sentiment === 'Negative') entry.negativeCount += 1;
      if (asp.sentiment === 'Neutral') entry.neutralCount += 1;
      entry.totalMentions += 1;
      aspectMap.set(asp.aspectCategory, entry);
    }
  }

  const sortMapDesc = (m: Map<string, number>) =>
    Array.from(m.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  const aspectSummary = Array.from(aspectMap.values()).sort(
    (a, b) => b.totalMentions - a.totalMentions
  );

  const mostPositiveAspects = aspectSummary
    .filter((a) => a.positiveCount > 0)
    .sort((a, b) => b.positiveCount - a.positiveCount)
    .slice(0, 6);

  const mostNegativeAspects = aspectSummary
    .filter((a) => a.negativeCount > 0)
    .sort((a, b) => b.negativeCount - a.negativeCount)
    .slice(0, 6);

  return {
    totalStatementsAnalyzed: results.length,
    totalAspectsExtracted,
    sentimentCounts,
    sarcasmDetectedCount,
    negationCount,
    commentTypeSummary: sortMapDesc(commentTypeCounts),
    toneSummary: sortMapDesc(toneCounts),
    emotionSummary: sortMapDesc(emotionCounts),
    intentSummary: sortMapDesc(intentCounts),
    aspectSummary,
    mostPositiveAspects,
    mostNegativeAspects,
  };
}

export function createAbsaRouter(): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      inferenceReady: defaultStatementProvider.isAvailable(),
      embeddingsReady: defaultStatementProvider.isAvailable(),
      providerName: defaultStatementProvider.providerName,
      isApiBased: defaultStatementProvider.isApiBased,
      storageEngine: 'SQLite (node:sqlite)',
      privacyNotice:
        'Text submitted for analysis is processed server-side via the configured external Gemini API provider. Do not submit sensitive secrets.',
    });
  });

  // Single Statement Analysis (persists automatically to History)
  router.post('/analyze', async (req, res) => {
    const body = (req.body ?? {}) as { text?: unknown };
    if (typeof body.text !== 'string') {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Request must include a string field "text".',
      });
      return;
    }

    const trimmed = body.text.trim();
    if (trimmed.length < MIN_STATEMENT_LENGTH) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Statement must be at least ${MIN_STATEMENT_LENGTH} characters long.`,
      });
      return;
    }
    if (trimmed.length > MAX_STATEMENT_LENGTH) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Statement must not exceed ${MAX_STATEMENT_LENGTH} characters.`,
      });
      return;
    }

    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage:
          'Server NLP inference credentials (GEMINI_API_KEY) are missing. Configure GEMINI_API_KEY in Settings > Secrets.',
      });
      return;
    }

    try {
      const startedAt = performance.now();
      const analysisId = `ANL-${Date.now()}`;
      const rawResult = await defaultStatementProvider.analyzeStatement('STMT-1', trimmed);
      const processingTimeMs = Number((performance.now() - startedAt).toFixed(2));
      const result: StatementAnalysisOutput = { ...rawResult, analysisId };

      historyDb.saveStatementAnalysis(analysisId, result);

      res.json({
        ok: true,
        analysisId,
        providerName: defaultStatementProvider.providerName,
        isApiBased: defaultStatementProvider.isApiBased,
        processingTimeMs,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Statement analysis failed.';
      const isTimeout = message.toLowerCase().includes('timed out');
      res.status(isTimeout ? 504 : 502).json({
        ok: false,
        errorCode: isTimeout ? 'TIMEOUT_ERROR' : 'UPSTREAM_ERROR',
        errorMessage: message,
      });
    }
  });

  // Progressive Batch Chunk Processing (allows client progress bar + per-row error reporting)
  router.post('/analyze/batch/chunk', async (req, res) => {
    const body = (req.body ?? {}) as { rows?: unknown };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Chunk request must include a non-empty "rows" array.',
      });
      return;
    }
    if (body.rows.length > MAX_CHUNK_ROWS) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Chunk size must not exceed ${MAX_CHUNK_ROWS} rows.`,
      });
      return;
    }
    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage: 'Server NLP inference credentials (GEMINI_API_KEY) are missing.',
      });
      return;
    }

    const validInputs: BatchStatementInput[] = [];
    const failedRows: BatchRowError[] = [];

    for (let i = 0; i < body.rows.length; i += 1) {
      const raw = (body.rows[i] ?? {}) as {
        statementId?: unknown;
        text?: unknown;
        speaker?: unknown;
        timestamp?: unknown;
      };
      const statementId =
        typeof raw.statementId === 'string' && raw.statementId.trim()
          ? raw.statementId.trim()
          : `ROW-${i + 1}`;
      const text = typeof raw.text === 'string' ? raw.text.trim() : '';

      if (text.length < MIN_STATEMENT_LENGTH || text.length > MAX_STATEMENT_LENGTH) {
        failedRows.push({
          statementId,
          text,
          error: `Length must be between ${MIN_STATEMENT_LENGTH} and ${MAX_STATEMENT_LENGTH} characters.`,
        });
      } else {
        validInputs.push({
          statementId,
          text,
          speaker: typeof raw.speaker === 'string' && raw.speaker.trim() ? raw.speaker.trim() : null,
          timestamp:
            typeof raw.timestamp === 'string' && raw.timestamp.trim()
              ? raw.timestamp.trim()
              : null,
        });
      }
    }

    if (validInputs.length === 0) {
      res.json({ ok: true, results: [], failedRows });
      return;
    }

    try {
      const results = await defaultStatementProvider.analyzeBatch(validInputs);
      res.json({ ok: true, results, failedRows });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch chunk failed.';
      // Record chunk-level failure per row so batch run can still produce an error report
      const chunkFailures: BatchRowError[] = validInputs.map((item) => ({
        statementId: item.statementId,
        text: item.text,
        error: message,
      }));
      res.status(502).json({
        ok: false,
        errorCode: 'UPSTREAM_ERROR',
        errorMessage: message,
        results: [],
        failedRows: [...failedRows, ...chunkFailures],
      });
    }
  });

  // Finalize progressive batch run: computes aggregations and persists to SQLite
  router.post('/analyze/batch/finalize', (req, res) => {
    const body = (req.body ?? {}) as {
      datasetName?: unknown;
      inputMethod?: unknown;
      totalSubmitted?: unknown;
      processingTimeMs?: unknown;
      results?: unknown;
      failedRows?: unknown;
    };

    if (!Array.isArray(body.results)) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Finalize request must include "results" array.',
      });
      return;
    }

    const results = body.results as StatementAnalysisOutput[];
    const failedRows = Array.isArray(body.failedRows) ? (body.failedRows as BatchRowError[]) : [];
    const aggregations = computeBatchAggregations(results);
    const datasetName =
      typeof body.datasetName === 'string' && body.datasetName.trim()
        ? body.datasetName.trim()
        : 'Statement Batch';
    const inputMethod =
      body.inputMethod === 'csv_upload' || body.inputMethod === 'manual_batch'
        ? body.inputMethod
        : 'manual_batch';

    const batchRecord = {
      ok: true,
      datasetId: `BATCH-${Date.now()}`,
      datasetName,
      inputMethod,
      providerName: defaultStatementProvider.providerName,
      isApiBased: defaultStatementProvider.isApiBased,
      analyzedAt: new Date().toISOString(),
      totalSubmitted:
        typeof body.totalSubmitted === 'number'
          ? body.totalSubmitted
          : results.length + failedRows.length,
      failedCount: failedRows.length,
      failedRows,
      skippedCount: failedRows.length,
      processingTimeMs: typeof body.processingTimeMs === 'number' ? body.processingTimeMs : 0,
      ...aggregations,
      results,
    };

    historyDb.saveBatchRun(batchRecord);
    res.json(batchRecord);
  });

  // Single-call Batch Endpoint (kept for direct API clients & validation suite)
  router.post('/analyze/batch', async (req, res) => {
    const body = (req.body ?? {}) as {
      datasetName?: unknown;
      inputMethod?: unknown;
      rows?: unknown;
    };
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Batch request must include a non-empty "rows" array.',
      });
      return;
    }

    if (body.rows.length > MAX_BATCH_ROWS) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Batch size exceeds maximum limit of ${MAX_BATCH_ROWS} statements per request.`,
      });
      return;
    }

    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage: 'Server NLP inference credentials (GEMINI_API_KEY) are missing.',
      });
      return;
    }

    const validInputs: BatchStatementInput[] = [];
    const failedRows: BatchRowError[] = [];

    for (let i = 0; i < body.rows.length; i += 1) {
      const raw = (body.rows[i] ?? {}) as {
        statementId?: unknown;
        text?: unknown;
        speaker?: unknown;
        timestamp?: unknown;
      };
      const statementId =
        typeof raw.statementId === 'string' && raw.statementId.trim()
          ? raw.statementId.trim()
          : `STMT-${String(i + 1).padStart(3, '0')}`;
      const text = typeof raw.text === 'string' ? raw.text.trim() : '';

      if (text.length < MIN_STATEMENT_LENGTH) {
        failedRows.push({
          statementId,
          text,
          error: `Shorter than ${MIN_STATEMENT_LENGTH} characters.`,
        });
      } else if (text.length > MAX_STATEMENT_LENGTH) {
        failedRows.push({
          statementId,
          text,
          error: `Exceeds ${MAX_STATEMENT_LENGTH} characters.`,
        });
      } else {
        validInputs.push({
          statementId,
          text,
          speaker: typeof raw.speaker === 'string' && raw.speaker.trim() ? raw.speaker.trim() : null,
          timestamp:
            typeof raw.timestamp === 'string' && raw.timestamp.trim()
              ? raw.timestamp.trim()
              : null,
        });
      }
    }

    if (validInputs.length === 0) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'No valid statements remain after validation.',
      });
      return;
    }

    const datasetName =
      typeof body.datasetName === 'string' && body.datasetName.trim()
        ? body.datasetName.trim()
        : 'Statement Batch';
    const inputMethod =
      body.inputMethod === 'csv_upload' || body.inputMethod === 'manual_batch'
        ? body.inputMethod
        : 'manual_batch';

    try {
      const startedAt = performance.now();
      const analyzedResults = await defaultStatementProvider.analyzeBatch(validInputs);
      const processingTimeMs = Number((performance.now() - startedAt).toFixed(2));
      const aggregations = computeBatchAggregations(analyzedResults);

      const batchRecord = {
        ok: true,
        datasetId: `BATCH-${Date.now()}`,
        datasetName,
        inputMethod,
        providerName: defaultStatementProvider.providerName,
        isApiBased: defaultStatementProvider.isApiBased,
        analyzedAt: new Date().toISOString(),
        totalSubmitted: body.rows.length,
        failedCount: failedRows.length,
        failedRows,
        skippedCount: failedRows.length,
        processingTimeMs,
        ...aggregations,
        results: analyzedResults,
      };

      historyDb.saveBatchRun(batchRecord);
      res.json(batchRecord);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch analysis failed.';
      const isTimeout = message.toLowerCase().includes('timed out');
      res.status(isTimeout ? 504 : 502).json({
        ok: false,
        errorCode: isTimeout ? 'TIMEOUT_ERROR' : 'UPSTREAM_ERROR',
        errorMessage: message,
      });
    }
  });

  // Conversation Analyzer
  router.post('/conversation/analyze', async (req, res) => {
    const body = (req.body ?? {}) as { title?: unknown; messages?: unknown };
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Conversation request must include a non-empty "messages" array.',
      });
      return;
    }

    if (body.messages.length > MAX_CONVERSATION_MESSAGES) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: `Conversation length must not exceed ${MAX_CONVERSATION_MESSAGES} messages.`,
      });
      return;
    }

    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage: 'Server NLP inference credentials (GEMINI_API_KEY) are missing.',
      });
      return;
    }

    const cleaned: ConversationMessageInput[] = [];
    for (let i = 0; i < body.messages.length; i += 1) {
      const m = (body.messages[i] ?? {}) as {
        messageId?: unknown;
        speaker?: unknown;
        timestamp?: unknown;
        text?: unknown;
      };
      const text = typeof m.text === 'string' ? m.text.trim() : '';
      if (text.length < MIN_STATEMENT_LENGTH) continue;
      cleaned.push({
        messageId:
          typeof m.messageId === 'string' && m.messageId.trim()
            ? m.messageId.trim()
            : `MSG-${String(i + 1).padStart(3, '0')}`,
        speaker: typeof m.speaker === 'string' && m.speaker.trim() ? m.speaker.trim() : null,
        timestamp:
          typeof m.timestamp === 'string' && m.timestamp.trim() ? m.timestamp.trim() : null,
        text: text.slice(0, MAX_STATEMENT_LENGTH),
      });
    }

    if (cleaned.length < 2) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Provide at least 2 valid messages to analyze a conversation.',
      });
      return;
    }

    const title =
      typeof body.title === 'string' && body.title.trim()
        ? body.title.trim()
        : `Conversation (${cleaned.length} messages)`;

    try {
      const result = await analyzeConversationMessages({ title, messages: cleaned });
      historyDb.saveConversationRun(result);
      res.json({ ok: true, conversation: result });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Conversation analysis failed.';
      res.status(502).json({
        ok: false,
        errorCode: 'UPSTREAM_ERROR',
        errorMessage: message,
      });
    }
  });

  // Semantic Search (gemini-embedding-2)
  router.post('/semantic/search', async (req, res) => {
    const body = (req.body ?? {}) as {
      query?: unknown;
      documents?: unknown;
      topK?: unknown;
    };
    if (typeof body.query !== 'string' || body.query.trim().length < 2) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Semantic search requires a query of at least 2 characters.',
      });
      return;
    }
    if (!Array.isArray(body.documents) || body.documents.length === 0) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Provide analyzed statements to search across.',
      });
      return;
    }
    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage: 'Server embedding credentials (GEMINI_API_KEY) are missing.',
      });
      return;
    }

    try {
      const docs = (body.documents as Array<{
        statementId?: string;
        text?: string;
        overallSentiment?: OverallSentiment;
      }>)
        .filter((d) => typeof d.text === 'string' && d.text.trim().length > 0)
        .map((d, idx) => ({
          statementId: d.statementId ?? `DOC-${idx + 1}`,
          text: d.text!.trim(),
          overallSentiment: d.overallSentiment ?? 'Neutral',
        }));

      const result = await runSemanticSearch({
        query: body.query.trim(),
        documents: docs,
        topK: typeof body.topK === 'number' ? body.topK : 10,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(502).json({
        ok: false,
        errorCode: 'UPSTREAM_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Semantic search failed.',
      });
    }
  });

  // Topic Discovery Clustering
  router.post('/semantic/topics', async (req, res) => {
    const body = (req.body ?? {}) as { documents?: unknown };
    if (!Array.isArray(body.documents) || body.documents.length < 3) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Topic clustering requires at least 3 analyzed statements.',
      });
      return;
    }
    if (!defaultStatementProvider.isAvailable()) {
      res.status(503).json({
        ok: false,
        errorCode: 'API_KEY_MISSING',
        errorMessage: 'Server embedding credentials (GEMINI_API_KEY) are missing.',
      });
      return;
    }

    try {
      const docs = (body.documents as Array<{
        statementId?: string;
        text?: string;
        overallSentiment?: OverallSentiment;
      }>)
        .filter((d) => typeof d.text === 'string' && d.text.trim().length > 0)
        .map((d, idx) => ({
          statementId: d.statementId ?? `DOC-${idx + 1}`,
          text: d.text!.trim(),
          overallSentiment: d.overallSentiment ?? 'Neutral',
        }));

      const result = await runTopicClustering({ documents: docs });
      res.json({ ok: true, ...result });
    } catch (error) {
      res.status(502).json({
        ok: false,
        errorCode: 'UPSTREAM_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Topic clustering failed.',
      });
    }
  });

  // Analysis History & Persistence
  router.get('/history', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const sentiment = typeof req.query.sentiment === 'string' ? req.query.sentiment : 'All';
    const date = typeof req.query.date === 'string' ? req.query.date : '';
    const records = historyDb.listHistory({ search, sentiment, date });
    res.json({ ok: true, storageEngine: 'SQLite (node:sqlite)', records });
  });

  router.get('/history/:id', (req, res) => {
    const found = historyDb.getHistoryPayload(req.params.id);
    if (!found) {
      res.status(404).json({ ok: false, errorMessage: 'History record not found.' });
      return;
    }
    res.json({ ok: true, ...found });
  });

  router.delete('/history/:id', (req, res) => {
    const deleted = historyDb.deleteHistory(req.params.id);
    if (!deleted) {
      res.status(404).json({ ok: false, errorMessage: 'History record not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // Analytics Stored Batch Runs
  router.get('/analytics/batches', (_req, res) => {
    const batches = historyDb.listBatchRuns();
    res.json({ ok: true, batches });
  });

  // Explainable AI Prediction Feedback
  router.post('/feedback', (req, res) => {
    const body = (req.body ?? {}) as {
      analysisId?: unknown;
      inputText?: unknown;
      predictedSentiment?: unknown;
      isCorrect?: unknown;
      reportedIssue?: unknown;
      notes?: unknown;
    };
    if (
      typeof body.analysisId !== 'string' ||
      typeof body.inputText !== 'string' ||
      typeof body.isCorrect !== 'boolean'
    ) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Feedback requires analysisId, inputText, and boolean isCorrect.',
      });
      return;
    }

    const record = historyDb.saveFeedback({
      analysisId: body.analysisId,
      inputText: body.inputText.slice(0, 1000),
      predictedSentiment:
        typeof body.predictedSentiment === 'string' ? body.predictedSentiment : 'Unknown',
      isCorrect: body.isCorrect,
      reportedIssue:
        typeof body.reportedIssue === 'string' && body.reportedIssue.trim()
          ? body.reportedIssue.trim()
          : null,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null,
    });

    res.json({ ok: true, record });
  });

  router.get('/feedback', (_req, res) => {
    const records = historyDb.listFeedback();
    res.json({ ok: true, records });
  });

  // Real Local Model Evaluation (TF-IDF + Logistic Regression)
  router.get('/evaluation', (_req, res) => {
    const runs = historyDb.listEvaluationRuns();
    res.json({ ok: true, runs });
  });

  router.post('/evaluation/run', (req, res) => {
    const body = (req.body ?? {}) as {
      datasetName?: unknown;
      samples?: unknown;
      epochs?: unknown;
    };

    if (!Array.isArray(body.samples) || body.samples.length < 10) {
      res.status(400).json({
        ok: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage:
          'Evaluation requires at least 10 labeled samples ({ text, label }) to run a real train/test split.',
      });
      return;
    }

    const samples = body.samples
      .map((s) => {
        const item = (s ?? {}) as { text?: unknown; label?: unknown };
        return {
          text: typeof item.text === 'string' ? item.text : '',
          label: typeof item.label === 'string' ? item.label : '',
        };
      })
      .filter((s) => s.text.trim().length >= 2 && s.label.trim().length > 0);

    try {
      const record = trainAndEvaluateTfidfLogisticRegression({
        datasetName:
          typeof body.datasetName === 'string' && body.datasetName.trim()
            ? body.datasetName.trim()
            : 'Custom Labeled Dataset',
        samples,
        epochs: typeof body.epochs === 'number' ? body.epochs : 40,
      });

      historyDb.saveEvaluationRun(record);
      res.json({ ok: true, record });
    } catch (error) {
      res.status(400).json({
        ok: false,
        errorCode: 'EVALUATION_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Evaluation failed.',
      });
    }
  });

  return router;
}
