import {
  BatchAnalysisResult,
  BatchRowError,
  ConversationAnalysisResult,
  StatementAnalysisOutput,
} from '../types/absa';

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeFileSlug(name: string): string {
  return (
    name
      .replace(/\.csv$/i, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  );
}

export function exportPredictionsCsv(batch: BatchAnalysisResult): void {
  const headers = [
    'statement_id',
    'speaker',
    'timestamp',
    'original_statement',
    'overall_sentiment',
    'uncertainty_level',
    'comment_types',
    'tone',
    'emotion',
    'communication_intent',
    'sarcasm_or_irony',
    'contains_negation',
    'aspect_term',
    'aspect_category',
    'aspect_type',
    'opinion_expression',
    'aspect_sentiment',
    'interpretation',
  ];

  const csvLines: string[] = [headers.join(',')];

  for (const stmt of batch.results) {
    if (stmt.aspects.length === 0) {
      csvLines.push(
        [
          stmt.statementId,
          stmt.speaker ?? '',
          stmt.timestamp ?? '',
          stmt.originalText,
          stmt.overallSentiment,
          stmt.uncertaintyLevel,
          stmt.commentTypes.join('; '),
          stmt.tone,
          stmt.emotion,
          stmt.communicationIntent,
          stmt.languageAnalysis.sarcasmOrIrony,
          stmt.languageAnalysis.containsNegation ? 'Yes' : 'No',
          'No aspect detected',
          '',
          '',
          '',
          '',
          stmt.insights.interpretation,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
      continue;
    }

    for (const asp of stmt.aspects) {
      csvLines.push(
        [
          stmt.statementId,
          stmt.speaker ?? '',
          stmt.timestamp ?? '',
          stmt.originalText,
          stmt.overallSentiment,
          stmt.uncertaintyLevel,
          stmt.commentTypes.join('; '),
          stmt.tone,
          stmt.emotion,
          stmt.communicationIntent,
          stmt.languageAnalysis.sarcasmOrIrony,
          stmt.languageAnalysis.containsNegation ? 'Yes' : 'No',
          asp.aspectTerm ?? 'Implicit',
          asp.aspectCategory,
          asp.isImplicit ? 'Implicit' : 'Explicit',
          asp.opinionExpression,
          asp.sentiment,
          stmt.insights.interpretation,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  triggerDownload(
    `aspectiq-batch-results-${sanitizeFileSlug(batch.datasetName)}.csv`,
    csvLines.join('\n'),
    'text/csv;charset=utf-8'
  );
}

export function exportFailedRowsCsv(datasetName: string, failedRows: BatchRowError[]): void {
  const lines = ['statement_id,text,error_reason'];
  for (const row of failedRows) {
    lines.push([row.statementId, row.text, row.error].map(escapeCsvCell).join(','));
  }
  triggerDownload(
    `aspectiq-errors-${sanitizeFileSlug(datasetName)}.csv`,
    lines.join('\n'),
    'text/csv;charset=utf-8'
  );
}

export function exportSingleStatementJson(statement: StatementAnalysisOutput): void {
  triggerDownload(
    `aspectiq-statement-${sanitizeFileSlug(statement.analysisId ?? statement.statementId)}.json`,
    JSON.stringify(statement, null, 2),
    'application/json;charset=utf-8'
  );
}

export function exportConversationJson(conversation: ConversationAnalysisResult): void {
  triggerDownload(
    `aspectiq-conversation-${sanitizeFileSlug(conversation.title)}.json`,
    JSON.stringify(conversation, null, 2),
    'application/json;charset=utf-8'
  );
}

export function exportSummaryReportCsv(batch: BatchAnalysisResult): void {
  const lines: string[] = [];
  const total = batch.totalStatementsAnalyzed;
  const pct = (count: number) => (total > 0 ? `${((count / total) * 100).toFixed(1)}%` : '0.0%');

  lines.push('AspectIQ 2.0 Batch Intelligence Summary');
  lines.push(['Dataset', batch.datasetName].map(escapeCsvCell).join(','));
  lines.push(['Input Method', batch.inputMethod].map(escapeCsvCell).join(','));
  lines.push(['Analyzed At', batch.analyzedAt].map(escapeCsvCell).join(','));
  lines.push(['Total Records Submitted', batch.totalSubmitted].map(escapeCsvCell).join(','));
  lines.push(['Successfully Analyzed', batch.totalStatementsAnalyzed].map(escapeCsvCell).join(','));
  lines.push(['Failed Records', batch.failedCount].map(escapeCsvCell).join(','));
  lines.push(['Total Aspects Extracted', batch.totalAspectsExtracted].map(escapeCsvCell).join(','));
  lines.push(['Positive', `${batch.sentimentCounts.Positive} (${pct(batch.sentimentCounts.Positive)})`].map(escapeCsvCell).join(','));
  lines.push(['Negative', `${batch.sentimentCounts.Negative} (${pct(batch.sentimentCounts.Negative)})`].map(escapeCsvCell).join(','));
  lines.push(['Mixed', `${batch.sentimentCounts.Mixed} (${pct(batch.sentimentCounts.Mixed)})`].map(escapeCsvCell).join(','));
  lines.push(['Neutral', `${batch.sentimentCounts.Neutral} (${pct(batch.sentimentCounts.Neutral)})`].map(escapeCsvCell).join(','));
  lines.push('');
  lines.push(['aspect_category', 'positive_count', 'neutral_count', 'negative_count', 'total_mentions'].join(','));

  for (const row of batch.aspectSummary) {
    lines.push(
      [row.aspectCategory, row.positiveCount, row.neutralCount, row.negativeCount, row.totalMentions]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  triggerDownload(
    `aspectiq-summary-${sanitizeFileSlug(batch.datasetName)}.csv`,
    lines.join('\n'),
    'text/csv;charset=utf-8'
  );
}

export function exportSummaryReportJson(batch: BatchAnalysisResult): void {
  triggerDownload(
    `aspectiq-batch-${sanitizeFileSlug(batch.datasetName)}.json`,
    JSON.stringify(batch, null, 2),
    'application/json;charset=utf-8'
  );
}

export function downloadCsvIngestionTemplate(): void {
  const csvRows = [
    'statement_id,speaker,timestamp,statement',
    'STMT-001,Customer A,2026-11-18,"The new update looks fantastic, but it has made the application incredibly slow."',
    'STMT-002,Customer B,2026-11-19,"Wow, another brilliant decision! Now everything is broken."',
    'STMT-003,Student,2026-11-20,"Your explanation was clear and easy to understand."',
    'STMT-004,Manager,2026-11-21,"I appreciate your help, but I disagree with your conclusion."',
  ];

  triggerDownload('aspectiq-batch-template.csv', csvRows.join('\n'), 'text/csv;charset=utf-8');
}
