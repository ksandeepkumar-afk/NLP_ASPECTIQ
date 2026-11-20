import { CsvValidationSummary, ParsedCsvRow } from '../types/absa';

const MAX_CSV_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB safety limit
const MIN_REVIEW_LENGTH = 8;
const MAX_REVIEW_LENGTH = 4000;

/**
 * Splits a single CSV line respecting RFC-4180 double-quoted fields and escaped quotes.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Validates and parses an uploaded CSV file for batch review ingestion.
 * Requires a `review_text` (or `text` / `review`) column header.
 */
export async function validateAndParseCsvFile(file: File): Promise<CsvValidationSummary> {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      detectedColumns: [],
      rows: [],
      fatalError: 'Unsupported file format. Please upload a UTF-8 .csv file.',
    };
  }

  if (file.size === 0) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      detectedColumns: [],
      rows: [],
      fatalError: 'The uploaded CSV file is empty.',
    };
  }

  if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      detectedColumns: [],
      rows: [],
      fatalError: 'File exceeds the 5 MB ingestion limit. Split large datasets into smaller batches.',
    };
  }

  const rawText = await file.text();
  const normalizedLines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (normalizedLines.length < 2) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      detectedColumns: [],
      rows: [],
      fatalError: 'CSV must include a header row and at least one review record.',
    };
  }

  const headerFields = parseCsvLine(normalizedLines[0]).map((col) =>
    col.toLowerCase().replace(/\s+/g, '_')
  );

  const textColIndex = headerFields.findIndex((col) =>
    ['review_text', 'text', 'review', 'sentence'].includes(col)
  );

  if (textColIndex === -1) {
    return {
      fileName: file.name,
      fileSizeBytes: file.size,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      detectedColumns: headerFields,
      rows: [],
      fatalError:
        'Missing required review text column. Expected header: "review_text", "text", or "review".',
    };
  }

  const idColIndex = headerFields.findIndex((col) => ['id', 'review_id'].includes(col));
  const domainColIndex = headerFields.findIndex((col) =>
    ['domain', 'category', 'dataset'].includes(col)
  );

  const parsedRows: ParsedCsvRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 1; i < normalizedLines.length; i += 1) {
    const values = parseCsvLine(normalizedLines[i]);
    const reviewText = (values[textColIndex] ?? '').trim();
    const reviewId =
      idColIndex !== -1 && values[idColIndex] ? values[idColIndex] : `ROW-${String(i).padStart(3, '0')}`;
    const domain =
      domainColIndex !== -1 && values[domainColIndex] ? values[domainColIndex] : 'Unspecified';

    let validationError: string | null = null;
    if (!reviewText) {
      validationError = 'Empty review text.';
    } else if (reviewText.length < MIN_REVIEW_LENGTH) {
      validationError = `Review shorter than ${MIN_REVIEW_LENGTH} characters.`;
    } else if (reviewText.length > MAX_REVIEW_LENGTH) {
      validationError = `Review exceeds ${MAX_REVIEW_LENGTH} character limit.`;
    }

    const isValid = validationError === null;
    if (isValid) {
      validCount += 1;
    } else {
      invalidCount += 1;
    }

    parsedRows.push({
      rowNumber: i,
      reviewId,
      domain,
      reviewText,
      isValid,
      validationError,
    });
  }

  return {
    fileName: file.name,
    fileSizeBytes: file.size,
    totalRows: parsedRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    detectedColumns: headerFields,
    rows: parsedRows,
    fatalError: null,
  };
}

export function validateSingleReviewInput(text: string): { valid: boolean; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a customer review before submitting.' };
  }
  if (trimmed.length < MIN_REVIEW_LENGTH) {
    return {
      valid: false,
      error: `Review text must be at least ${MIN_REVIEW_LENGTH} characters for meaningful aspect extraction.`,
    };
  }
  if (trimmed.length > MAX_REVIEW_LENGTH) {
    return {
      valid: false,
      error: `Review text exceeds the maximum allowed length of ${MAX_REVIEW_LENGTH} characters.`,
    };
  }
  return { valid: true, error: null };
}
