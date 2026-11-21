/**
 * NLP Preprocessing & Discourse Clause Segmentation
 * Splits reviews into clauses along sentence boundaries and contrastive
 * conjunctions while preserving exact character offsets for span alignment.
 */

export interface DiscourseClause {
  text: string;
  startOffset: number;
  endOffset: number;
  tokens: string[];
}

const CONTRAST_SPLIT_REGEX =
  /(?:[.!?;\n]+|,\s*(?=(?:but|though|although|however|yet|while|whereas|despite)\b)|\s+(?=(?:but|however|although|though|yet|whereas)\b))/gi;

const CONTRACTION_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bdon't\b/gi, 'do not'],
  [/\bdoesn't\b/gi, 'does not'],
  [/\bdidn't\b/gi, 'did not'],
  [/\bwasn't\b/gi, 'was not'],
  [/\bweren't\b/gi, 'were not'],
  [/\bisn't\b/gi, 'is not'],
  [/\baren't\b/gi, 'are not'],
  [/\bcan't\b/gi, 'cannot'],
  [/\bcouldn't\b/gi, 'could not'],
  [/\bwouldn't\b/gi, 'would not'],
  [/\bshouldn't\b/gi, 'should not'],
  [/\bwon't\b/gi, 'will not'],
  [/\bhaven't\b/gi, 'have not'],
  [/\bhasn't\b/gi, 'has not'],
  [/\bhadn't\b/gi, 'had not'],
  [/\bit's\b/gi, 'it is'],
  [/\bthat's\b/gi, 'that is'],
];

export function normalizeTextForTokens(raw: string): string {
  let normalized = raw;
  for (const [pattern, replacement] of CONTRACTION_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.toLowerCase();
}

export function tokenizeClause(clauseText: string): string[] {
  const normalized = normalizeTextForTokens(clauseText);
  const matches = normalized.match(/[a-z0-9]+(?:-[a-z0-9]+)?/g);
  return matches ?? [];
}

/**
 * Splits a review into discourse clauses with exact start/end character offsets.
 * Handles secondary coordination splits (", and ") only when clauses are long enough
 * to represent independent aspect opinions.
 */
export function segmentIntoClauses(reviewText: string): DiscourseClause[] {
  const clauses: DiscourseClause[] = [];
  let lastIndex = 0;

  const splitPoints: Array<{ index: number; matchLength: number }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(CONTRAST_SPLIT_REGEX.source, 'gi');

  while ((match = regex.exec(reviewText)) !== null) {
    splitPoints.push({ index: match.index, matchLength: match[0].length });
  }

  const rawSegments: Array<{ start: number; end: number }> = [];
  for (const sp of splitPoints) {
    if (sp.index > lastIndex) {
      rawSegments.push({ start: lastIndex, end: sp.index });
    }
    lastIndex = sp.index + sp.matchLength;
  }
  if (lastIndex < reviewText.length) {
    rawSegments.push({ start: lastIndex, end: reviewText.length });
  }

  // Further split coordinate clauses on ", and " or ", " when both sides contain >= 2 tokens
  const refinedSegments: Array<{ start: number; end: number }> = [];
  for (const seg of rawSegments) {
    const slice = reviewText.slice(seg.start, seg.end);
    const commaOrAndRegex = /(?:,\s+and\s+|,\s+|\s+and\s+(?=(?:the|our|my|its|food|service|table|kitchen|bar|battery|camera|display|screen|speaker|price|pricing|ambience)\b))/gi;
    let subStart = 0;
    let subMatch: RegExpExecArray | null;
    while ((subMatch = commaOrAndRegex.exec(slice)) !== null) {
      const left = slice.slice(subStart, subMatch.index);
      const right = slice.slice(subMatch.index + subMatch[0].length);
      if (tokenizeClause(left).length >= 2 && tokenizeClause(right).length >= 2) {
        refinedSegments.push({ start: seg.start + subStart, end: seg.start + subMatch.index });
        subStart = subMatch.index + subMatch[0].length;
      }
    }
    refinedSegments.push({ start: seg.start + subStart, end: seg.end });
  }

  for (const seg of refinedSegments) {
    const rawSlice = reviewText.slice(seg.start, seg.end);
    const leadingTrim = rawSlice.length - rawSlice.trimStart().length;
    const trailingTrim = rawSlice.length - rawSlice.trimEnd().length;
    const cleanStart = seg.start + leadingTrim;
    const cleanEnd = seg.end - trailingTrim;
    if (cleanEnd > cleanStart) {
      const text = reviewText.slice(cleanStart, cleanEnd);
      clauses.push({
        text,
        startOffset: cleanStart,
        endOffset: cleanEnd,
        tokens: tokenizeClause(text),
      });
    }
  }

  return clauses;
}
