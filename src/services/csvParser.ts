import {
  ConversationMessageInput,
  CsvDatasetPreview,
  ParsedCsvDocument,
  RawStatementInputRow,
} from '../types/absa';

const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MIN_STATEMENT_LENGTH = 2;
export const MAX_STATEMENT_LENGTH = 4000;

const COMMON_TEXT_COLUMN_NAMES = [
  'statement',
  'statements',
  'text',
  'comment',
  'comments',
  'message',
  'messages',
  'review_text',
  'reviewtext',
  'review',
  'reviews',
  'feedback',
  'sentence',
  'content',
  'body',
];

const COMMON_ID_COLUMN_NAMES = ['statement_id', 'message_id', 'review_id', 'id', 'row_id'];
const COMMON_SPEAKER_COLUMN_NAMES = ['speaker', 'author', 'user', 'sender', 'role', 'name'];
const COMMON_TIMESTAMP_COLUMN_NAMES = ['timestamp', 'date', 'created_at', 'time', 'datetime'];

function parseCsvMatrix(rawText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  const text = rawText.replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeaderName(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

export async function parseCsvFileToDocument(file: File): Promise<ParsedCsvDocument> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      headers: [],
      rawRows: [],
      autoDetectedColumn: null,
      selectedColumn: null,
      idColumn: null,
      speakerColumn: null,
      timestampColumn: null,
      fatalError: 'Unsupported file format. Please upload a UTF-8 .csv file.',
    };
  }

  if (file.size === 0) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      headers: [],
      rawRows: [],
      autoDetectedColumn: null,
      selectedColumn: null,
      idColumn: null,
      speakerColumn: null,
      timestampColumn: null,
      fatalError: 'The uploaded CSV file is empty.',
    };
  }

  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      headers: [],
      rawRows: [],
      autoDetectedColumn: null,
      selectedColumn: null,
      idColumn: null,
      speakerColumn: null,
      timestampColumn: null,
      fatalError: 'File exceeds the 5 MB ingestion limit.',
    };
  }

  const rawText = await file.text();
  const matrix = parseCsvMatrix(rawText);

  if (matrix.length < 2) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      headers: matrix[0] ?? [],
      rawRows: [],
      autoDetectedColumn: null,
      selectedColumn: null,
      idColumn: null,
      speakerColumn: null,
      timestampColumn: null,
      fatalError: 'CSV must include a header row and at least one data record.',
    };
  }

  const rawHeaders = matrix[0].map((h, idx) => (h.trim() ? h.trim() : `column_${idx + 1}`));
  const normalizedHeaders = rawHeaders.map(normalizeHeaderName);
  const dataRows = matrix.slice(1);

  const autoTextIdx = normalizedHeaders.findIndex((h) => COMMON_TEXT_COLUMN_NAMES.includes(h));
  const idIdx = normalizedHeaders.findIndex((h) => COMMON_ID_COLUMN_NAMES.includes(h));
  const speakerIdx = normalizedHeaders.findIndex((h) => COMMON_SPEAKER_COLUMN_NAMES.includes(h));
  const timeIdx = normalizedHeaders.findIndex((h) => COMMON_TIMESTAMP_COLUMN_NAMES.includes(h));

  const autoDetectedColumn = autoTextIdx !== -1 ? rawHeaders[autoTextIdx] : null;

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    headers: rawHeaders,
    rawRows: dataRows,
    autoDetectedColumn,
    selectedColumn: autoDetectedColumn,
    idColumn: idIdx !== -1 ? rawHeaders[idIdx] : null,
    speakerColumn: speakerIdx !== -1 ? rawHeaders[speakerIdx] : null,
    timestampColumn: timeIdx !== -1 ? rawHeaders[timeIdx] : null,
    fatalError: null,
  };
}

export function buildCsvDatasetPreview(
  doc: ParsedCsvDocument,
  chosenTextColumn: string | null,
  chosenSpeakerColumn?: string | null,
  chosenTimestampColumn?: string | null
): CsvDatasetPreview {
  const speakerCol = chosenSpeakerColumn !== undefined ? chosenSpeakerColumn : doc.speakerColumn;
  const timeCol = chosenTimestampColumn !== undefined ? chosenTimestampColumn : doc.timestampColumn;

  if (doc.fatalError) {
    return {
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      headers: doc.headers,
      selectedColumn: null,
      speakerColumn: null,
      timestampColumn: null,
      autoDetected: false,
      totalRows: 0,
      validRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      rows: [],
      fatalError: doc.fatalError,
    };
  }

  if (!chosenTextColumn) {
    return {
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      headers: doc.headers,
      selectedColumn: null,
      speakerColumn: speakerCol,
      timestampColumn: timeCol,
      autoDetected: false,
      totalRows: doc.rawRows.length,
      validRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      rows: [],
      fatalError: null,
    };
  }

  const textColIndex = doc.headers.indexOf(chosenTextColumn);
  if (textColIndex === -1) {
    return {
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      headers: doc.headers,
      selectedColumn: null,
      speakerColumn: speakerCol,
      timestampColumn: timeCol,
      autoDetected: false,
      totalRows: doc.rawRows.length,
      validRows: 0,
      duplicateRows: 0,
      invalidRows: 0,
      rows: [],
      fatalError: `Selected column "${chosenTextColumn}" was not found in CSV headers.`,
    };
  }

  const idColIndex = doc.idColumn ? doc.headers.indexOf(doc.idColumn) : -1;
  const speakerColIndex = speakerCol ? doc.headers.indexOf(speakerCol) : -1;
  const timeColIndex = timeCol ? doc.headers.indexOf(timeCol) : -1;

  const seenNormalized = new Map<string, number>();
  const rows: RawStatementInputRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < doc.rawRows.length; i += 1) {
    const values = doc.rawRows[i];
    const rowNumber = i + 1;
    const text = (values[textColIndex] ?? '').trim();
    const statementId =
      idColIndex !== -1 && values[idColIndex]
        ? values[idColIndex].trim()
        : `ROW-${String(rowNumber).padStart(3, '0')}`;
    const speaker =
      speakerColIndex !== -1 && values[speakerColIndex]
        ? values[speakerColIndex].trim() || null
        : null;
    const timestamp =
      timeColIndex !== -1 && values[timeColIndex]
        ? values[timeColIndex].trim() || null
        : null;

    let validationError: string | null = null;
    let isDuplicate = false;

    if (!text) {
      validationError = 'Missing or empty text.';
    } else if (text.length < MIN_STATEMENT_LENGTH) {
      validationError = `Too short (< ${MIN_STATEMENT_LENGTH} chars).`;
    } else if (text.length > MAX_STATEMENT_LENGTH) {
      validationError = `Exceeds ${MAX_STATEMENT_LENGTH} chars.`;
    } else {
      const normalizedKey = text.toLowerCase().replace(/\s+/g, ' ');
      const firstSeenRow = seenNormalized.get(normalizedKey);
      if (firstSeenRow !== undefined) {
        isDuplicate = true;
        validationError = `Duplicate of row ${firstSeenRow}.`;
      } else {
        seenNormalized.set(normalizedKey, rowNumber);
      }
    }

    const isValid = validationError === null;
    if (isValid) validCount += 1;
    else if (isDuplicate) duplicateCount += 1;
    else invalidCount += 1;

    rows.push({
      rowNumber,
      statementId,
      speaker,
      timestamp,
      text,
      isValid,
      isDuplicate,
      validationError,
    });
  }

  return {
    fileName: doc.fileName,
    fileSizeBytes: doc.fileSizeBytes,
    headers: doc.headers,
    selectedColumn: chosenTextColumn,
    speakerColumn: speakerCol,
    timestampColumn: timeCol,
    autoDetected: chosenTextColumn === doc.autoDetectedColumn,
    totalRows: rows.length,
    validRows: validCount,
    duplicateRows: duplicateCount,
    invalidRows: invalidCount,
    rows,
    fatalError: null,
  };
}

export function parseManualBatchInput(rawText: string): {
  rows: RawStatementInputRow[];
  validCount: number;
  duplicateCount: number;
  invalidCount: number;
} {
  const candidates = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const seen = new Map<string, number>();
  const rows: RawStatementInputRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < candidates.length; i += 1) {
    const text = candidates[i];
    const rowNumber = i + 1;
    let validationError: string | null = null;
    let isDuplicate = false;

    if (text.length < MIN_STATEMENT_LENGTH) {
      validationError = `Shorter than ${MIN_STATEMENT_LENGTH} characters.`;
    } else if (text.length > MAX_STATEMENT_LENGTH) {
      validationError = `Exceeds ${MAX_STATEMENT_LENGTH} characters.`;
    } else {
      const norm = text.toLowerCase().replace(/\s+/g, ' ');
      const firstRow = seen.get(norm);
      if (firstRow !== undefined) {
        isDuplicate = true;
        validationError = `Duplicate of line #${firstRow}.`;
      } else {
        seen.set(norm, rowNumber);
      }
    }

    const isValid = validationError === null;
    if (isValid) validCount += 1;
    else if (isDuplicate) duplicateCount += 1;
    else invalidCount += 1;

    rows.push({
      rowNumber,
      statementId: `MAN-${String(rowNumber).padStart(3, '0')}`,
      speaker: null,
      timestamp: null,
      text,
      isValid,
      isDuplicate,
      validationError,
    });
  }

  return { rows, validCount, duplicateCount, invalidCount };
}

/**
 * Parses pasted chronological conversation lines.
 * Supports optional "Speaker: Message" format without inventing speakers when absent.
 */
export function parsePastedConversation(rawText: string): ConversationMessageInput[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= MIN_STATEMENT_LENGTH);

  return lines.map((line, idx) => {
    const colonMatch = line.match(/^([A-Za-z][A-Za-z0-9 _.-]{0,30}):\s+(.+)$/);
    if (colonMatch) {
      return {
        messageId: `MSG-${String(idx + 1).padStart(3, '0')}`,
        speaker: colonMatch[1].trim(),
        timestamp: null,
        text: colonMatch[2].trim(),
      };
    }
    return {
      messageId: `MSG-${String(idx + 1).padStart(3, '0')}`,
      speaker: null,
      timestamp: null,
      text: line,
    };
  });
}

/**
 * Parses a labeled CSV file containing text + label columns for Model Comparison evaluation.
 */
export async function parseLabeledEvaluationCsv(
  file: File
): Promise<{ samples: Array<{ text: string; label: string }>; error: string | null }> {
  const doc = await parseCsvFileToDocument(file);
  if (doc.fatalError) {
    return { samples: [], error: doc.fatalError };
  }
  const normalized = doc.headers.map(normalizeHeaderName);
  const textIdx = normalized.findIndex((h) => COMMON_TEXT_COLUMN_NAMES.includes(h));
  const labelIdx = normalized.findIndex((h) =>
    ['label', 'sentiment', 'polarity', 'class', 'target', 'category'].includes(h)
  );
  if (textIdx === -1 || labelIdx === -1) {
    return {
      samples: [],
      error:
        'Labeled CSV must contain a text column (e.g. text/statement/review) and a label column (e.g. label/sentiment).',
    };
  }

  const samples = doc.rawRows
    .map((r) => ({
      text: (r[textIdx] ?? '').trim(),
      label: (r[labelIdx] ?? '').trim(),
    }))
    .filter((s) => s.text.length >= MIN_STATEMENT_LENGTH && s.label.length > 0);

  if (samples.length < 10) {
    return {
      samples: [],
      error: 'At least 10 valid labeled rows are required for train/test evaluation.',
    };
  }

  return { samples, error: null };
}

export function validateSingleStatementInput(text: string): {
  valid: boolean;
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Enter a sentence, comment, review, or statement to analyze.',
    };
  }
  if (trimmed.length < MIN_STATEMENT_LENGTH) {
    return {
      valid: false,
      error: `Statement must be at least ${MIN_STATEMENT_LENGTH} characters long.`,
    };
  }
  if (trimmed.length > MAX_STATEMENT_LENGTH) {
    return {
      valid: false,
      error: `Statement exceeds the maximum allowed length of ${MAX_STATEMENT_LENGTH} characters.`,
    };
  }
  return { valid: true, error: null };
}
