/**
 * AspectIQ 2.0 — Persistent SQLite Storage Repository
 * Uses Node's built-in node:sqlite (DatabaseSync) behind clean repository methods
 * so PostgreSQL (via Drizzle or pg) can replace SQLite without changing API routes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  ConversationAnalysisResult,
  OverallSentiment,
  StatementAnalysisOutput,
} from '../services/inferenceProvider.ts';

export interface HistorySummaryRecord {
  id: string;
  createdAt: string;
  sourceType: 'statement' | 'batch' | 'conversation';
  inputPreview: string;
  overallSentiment: OverallSentiment;
  commentTypes: string[];
  mainAspects: string[];
  status: 'Completed' | 'Failed';
}

export interface StoredBatchSummary {
  batchId: string;
  createdAt: string;
  datasetName: string;
  inputMethod: string;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  payload: Record<string, unknown>;
}

export interface PredictionFeedbackRecord {
  id: string;
  createdAt: string;
  analysisId: string;
  inputText: string;
  predictedSentiment: string;
  isCorrect: boolean;
  reportedIssue: string | null;
  notes: string | null;
}

export interface StoredEvaluationRecord {
  id: string;
  createdAt: string;
  modelId: string;
  modelName: string;
  datasetName: string;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  trainingTimeMs: number;
  inferenceTimeMs: number;
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  labels: string[];
  confusionMatrix: number[][];
  lossHistory: Array<{ epoch: number; trainLoss: number; valLoss: number }>;
  notes: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'aspectiq.db');

class SqliteHistoryRepository {
  private db: DatabaseSync;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this.db = new DatabaseSync(DB_PATH);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        source_type TEXT NOT NULL,
        input_preview TEXT NOT NULL,
        overall_sentiment TEXT NOT NULL,
        comment_types_json TEXT NOT NULL,
        main_aspects_json TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS batch_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        dataset_name TEXT NOT NULL,
        input_method TEXT NOT NULL,
        total_records INTEGER NOT NULL,
        success_count INTEGER NOT NULL,
        failed_count INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversation_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        title TEXT NOT NULL,
        total_messages INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prediction_feedback (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        analysis_id TEXT NOT NULL,
        input_text TEXT NOT NULL,
        predicted_sentiment TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        reported_issue TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS evaluation_runs (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        model_id TEXT NOT NULL,
        model_name TEXT NOT NULL,
        dataset_name TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );
    `);
  }

  public saveStatementAnalysis(
    analysisId: string,
    output: StatementAnalysisOutput
  ): HistorySummaryRecord {
    const createdAt = new Date().toISOString();
    const mainAspects = output.aspects.map((a) =>
      a.aspectTerm ? `${a.aspectTerm} (${a.aspectCategory})` : a.aspectCategory
    );

    const payloadWithId: StatementAnalysisOutput = { ...output, analysisId };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO analysis_history
      (id, created_at, source_type, input_preview, overall_sentiment, comment_types_json, main_aspects_json, status, payload_json)
      VALUES (?, ?, 'statement', ?, ?, ?, ?, 'Completed', ?)
    `);

    stmt.run(
      analysisId,
      createdAt,
      output.originalText,
      output.overallSentiment,
      JSON.stringify(output.commentTypes),
      JSON.stringify(mainAspects),
      JSON.stringify(payloadWithId)
    );

    return {
      id: analysisId,
      createdAt,
      sourceType: 'statement',
      inputPreview: output.originalText,
      overallSentiment: output.overallSentiment,
      commentTypes: output.commentTypes,
      mainAspects,
      status: 'Completed',
    };
  }

  public saveBatchRun(batch: Record<string, unknown>): void {
    const id = String(batch.datasetId ?? `BATCH-${Date.now()}`);
    const createdAt = String(batch.analyzedAt ?? new Date().toISOString());
    const datasetName = String(batch.datasetName ?? 'Batch Dataset');
    const inputMethod = String(batch.inputMethod ?? 'csv_upload');
    const totalRecords = Number(batch.totalSubmitted ?? 0);
    const successCount = Number(batch.totalStatementsAnalyzed ?? 0);
    const failedCount = Number(batch.failedCount ?? 0);

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO batch_runs
      (id, created_at, dataset_name, input_method, total_records, success_count, failed_count, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        createdAt,
        datasetName,
        inputMethod,
        totalRecords,
        successCount,
        failedCount,
        JSON.stringify(batch)
      );

    // Also add concise index record to analysis_history
    const sentimentCounts = (batch.sentimentCounts ?? {}) as Record<string, number>;
    const topSentiment =
      (['Positive', 'Negative', 'Mixed', 'Neutral'] as OverallSentiment[]).sort(
        (a, b) => (sentimentCounts[b] ?? 0) - (sentimentCounts[a] ?? 0)
      )[0] ?? 'Neutral';
    const aspectSummary = Array.isArray(batch.aspectSummary)
      ? (batch.aspectSummary as Array<{ aspectCategory?: string }>)
          .slice(0, 5)
          .map((a) => String(a.aspectCategory ?? ''))
          .filter(Boolean)
      : [];

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO analysis_history
      (id, created_at, source_type, input_preview, overall_sentiment, comment_types_json, main_aspects_json, status, payload_json)
      VALUES (?, ?, 'batch', ?, ?, ?, ?, 'Completed', ?)
    `
      )
      .run(
        id,
        createdAt,
        `${datasetName} (${successCount} records)`,
        topSentiment,
        JSON.stringify(['Batch Dataset']),
        JSON.stringify(aspectSummary),
        JSON.stringify(batch)
      );
  }

  public saveConversationRun(conv: ConversationAnalysisResult): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO conversation_runs
      (id, created_at, title, total_messages, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        conv.conversationId,
        conv.analyzedAt,
        conv.title,
        conv.totalMessages,
        JSON.stringify(conv)
      );

    const pos = conv.messages.filter((m) => m.sentiment === 'Positive').length;
    const neg = conv.messages.filter((m) => m.sentiment === 'Negative').length;
    const dominant: OverallSentiment =
      pos > 0 && neg > 0 ? 'Mixed' : pos > neg ? 'Positive' : neg > pos ? 'Negative' : 'Neutral';

    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO analysis_history
      (id, created_at, source_type, input_preview, overall_sentiment, comment_types_json, main_aspects_json, status, payload_json)
      VALUES (?, ?, 'conversation', ?, ?, ?, ?, 'Completed', ?)
    `
      )
      .run(
        conv.conversationId,
        conv.analyzedAt,
        `${conv.title} (${conv.totalMessages} messages)`,
        dominant,
        JSON.stringify(['Conversation']),
        JSON.stringify(conv.repeatedTopics.slice(0, 5).map((t) => t.topic)),
        JSON.stringify(conv)
      );
  }

  public listHistory(filters?: {
    search?: string;
    sentiment?: string;
    date?: string;
  }): HistorySummaryRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, created_at, source_type, input_preview, overall_sentiment, comment_types_json, main_aspects_json, status
      FROM analysis_history
      ORDER BY created_at DESC
      LIMIT 250
    `
      )
      .all() as Array<{
      id: string;
      created_at: string;
      source_type: 'statement' | 'batch' | 'conversation';
      input_preview: string;
      overall_sentiment: OverallSentiment;
      comment_types_json: string;
      main_aspects_json: string;
      status: 'Completed' | 'Failed';
    }>;

    const search = filters?.search?.trim().toLowerCase() ?? '';
    const sentiment = filters?.sentiment ?? 'All';
    const date = filters?.date?.trim() ?? '';

    return rows
      .map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        sourceType: r.source_type,
        inputPreview: r.input_preview,
        overallSentiment: r.overall_sentiment,
        commentTypes: JSON.parse(r.comment_types_json) as string[],
        mainAspects: JSON.parse(r.main_aspects_json) as string[],
        status: r.status,
      }))
      .filter((item) => {
        if (sentiment && sentiment !== 'All' && item.overallSentiment !== sentiment) {
          return false;
        }
        if (date && !item.createdAt.startsWith(date)) {
          return false;
        }
        if (search) {
          const hit =
            item.inputPreview.toLowerCase().includes(search) ||
            item.id.toLowerCase().includes(search) ||
            item.commentTypes.some((c) => c.toLowerCase().includes(search)) ||
            item.mainAspects.some((a) => a.toLowerCase().includes(search));
          if (!hit) return false;
        }
        return true;
      });
  }

  public getHistoryPayload(id: string): {
    sourceType: 'statement' | 'batch' | 'conversation';
    payload: unknown;
  } | null {
    const row = this.db
      .prepare('SELECT source_type, payload_json FROM analysis_history WHERE id = ?')
      .get(id) as
      | { source_type: 'statement' | 'batch' | 'conversation'; payload_json: string }
      | undefined;

    if (!row) return null;
    return {
      sourceType: row.source_type,
      payload: JSON.parse(row.payload_json),
    };
  }

  public deleteHistory(id: string): boolean {
    const res = this.db.prepare('DELETE FROM analysis_history WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM batch_runs WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM conversation_runs WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  public listBatchRuns(): StoredBatchSummary[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, created_at, dataset_name, input_method, total_records, success_count, failed_count, payload_json
      FROM batch_runs
      ORDER BY created_at DESC
      LIMIT 100
    `
      )
      .all() as Array<{
      id: string;
      created_at: string;
      dataset_name: string;
      input_method: string;
      total_records: number;
      success_count: number;
      failed_count: number;
      payload_json: string;
    }>;

    return rows.map((r) => ({
      batchId: r.id,
      createdAt: r.created_at,
      datasetName: r.dataset_name,
      inputMethod: r.input_method,
      totalRecords: r.total_records,
      successCount: r.success_count,
      failedCount: r.failed_count,
      payload: JSON.parse(r.payload_json) as Record<string, unknown>,
    }));
  }

  public saveFeedback(params: {
    analysisId: string;
    inputText: string;
    predictedSentiment: string;
    isCorrect: boolean;
    reportedIssue: string | null;
    notes: string | null;
  }): PredictionFeedbackRecord {
    const id = `FB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();

    this.db
      .prepare(
        `
      INSERT INTO prediction_feedback
      (id, created_at, analysis_id, input_text, predicted_sentiment, is_correct, reported_issue, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        createdAt,
        params.analysisId,
        params.inputText,
        params.predictedSentiment,
        params.isCorrect ? 1 : 0,
        params.reportedIssue,
        params.notes
      );

    return {
      id,
      createdAt,
      analysisId: params.analysisId,
      inputText: params.inputText,
      predictedSentiment: params.predictedSentiment,
      isCorrect: params.isCorrect,
      reportedIssue: params.reportedIssue,
      notes: params.notes,
    };
  }

  public listFeedback(): PredictionFeedbackRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT id, created_at, analysis_id, input_text, predicted_sentiment, is_correct, reported_issue, notes
      FROM prediction_feedback
      ORDER BY created_at DESC
      LIMIT 200
    `
      )
      .all() as Array<{
      id: string;
      created_at: string;
      analysis_id: string;
      input_text: string;
      predicted_sentiment: string;
      is_correct: number;
      reported_issue: string | null;
      notes: string | null;
    }>;

    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      analysisId: r.analysis_id,
      inputText: r.input_text,
      predictedSentiment: r.predicted_sentiment,
      isCorrect: r.is_correct === 1,
      reportedIssue: r.reported_issue,
      notes: r.notes,
    }));
  }

  public saveEvaluationRun(record: StoredEvaluationRecord): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO evaluation_runs
      (id, created_at, model_id, model_name, dataset_name, payload_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        record.id,
        record.createdAt,
        record.modelId,
        record.modelName,
        record.datasetName,
        JSON.stringify(record)
      );
  }

  public listEvaluationRuns(): StoredEvaluationRecord[] {
    const rows = this.db
      .prepare(
        `
      SELECT payload_json FROM evaluation_runs
      ORDER BY created_at DESC
      LIMIT 50
    `
      )
      .all() as Array<{ payload_json: string }>;

    return rows.map((r) => JSON.parse(r.payload_json) as StoredEvaluationRecord);
  }
}

export const historyDb = new SqliteHistoryRepository();
