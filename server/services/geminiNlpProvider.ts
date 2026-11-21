/**
 * AspectIQ 2.0 — Internally Configured Domain-Independent Gemini NLP Provider
 * Separates model inference, strict schema validation, deterministic span/pronoun
 * post-processing, and explanation metadata without exposing API credentials.
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AnalyzedAspectOutput,
  AspectSentiment,
  BatchStatementInput,
  ExplorerSpan,
  OverallSentiment,
  SarcasmStatus,
  SpanHighlightCategory,
  StatementAnalysisOutput,
  StatementInferenceProvider,
  UncertaintyLevel,
} from './inferenceProvider.ts';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const REQUEST_TIMEOUT_MS = 40000;
const BATCH_CHUNK_SIZE = 8;

const PRONOUN_BLOCKLIST = new Set([
  'i',
  'me',
  'my',
  'mine',
  'myself',
  'you',
  'your',
  'yours',
  'yourself',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'we',
  'us',
  'our',
  'ours',
  'ourselves',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'this',
  'that',
  'these',
  'those',
]);

const NEGATION_WORD_REGEX =
  /\b(not|no|never|neither|nor|nothing|nowhere|hardly|scarcely|barely|without|n't|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|wouldn't|couldn't|shouldn't|mustn't)\b/gi;

export const ALLOWED_COMMENT_TYPES = [
  'Compliment',
  'Insult',
  'Sarcasm',
  'Complaint',
  'Criticism',
  'Praise',
  'Suggestion',
  'Recommendation',
  'Question',
  'Request',
  'Appreciation',
  'Gratitude',
  'Apology',
  'Agreement',
  'Disagreement',
  'Threat',
  'Warning',
  'Humor',
  'Joke',
  'Encouragement',
  'Observation',
  'Information',
  'Persuasion',
  'Other / Uncertain',
] as const;

export const ALLOWED_TONES = [
  'Friendly',
  'Polite',
  'Rude',
  'Hostile',
  'Angry',
  'Frustrated',
  'Happy',
  'Sad',
  'Excited',
  'Disappointed',
  'Respectful',
  'Confident',
  'Uncertain',
  'Humorous',
  'Sarcastic',
  'Neutral',
] as const;

export const ALLOWED_EMOTIONS = [
  'Joy',
  'Anger',
  'Sadness',
  'Fear',
  'Surprise',
  'Disgust',
  'Frustration',
  'Excitement',
  'Gratitude',
  'Disappointment',
  'Neutral',
  'Other',
] as const;

export const ALLOWED_INTENTS = [
  'Expressing an opinion',
  'Requesting help',
  'Giving information',
  'Making a suggestion',
  'Complaining',
  'Appreciating',
  'Persuading',
  'Warning',
  'Criticizing',
  'Asking a question',
  'Apologizing',
  'Other',
] as const;

const ALLOWED_COMMENT_SET = new Set<string>(ALLOWED_COMMENT_TYPES);
const ALLOWED_TONE_SET = new Set<string>(ALLOWED_TONES);
const ALLOWED_EMOTION_SET = new Set<string>(ALLOWED_EMOTIONS);
const ALLOWED_INTENT_SET = new Set<string>(ALLOWED_INTENTS);

const SYSTEM_INSTRUCTION = `You are AspectIQ 2.0, a domain-independent NLP Intelligence & Sentiment Analysis engine.
Analyze arbitrary statements from any context (personal conversations, social media, product/service reviews, workplace or academic feedback, factual remarks).

Classify each statement across INDEPENDENT dimensions — never conflate sentiment, comment type, tone, emotion, and communication intent:

1. OVERALL SENTIMENT ("Positive" | "Negative" | "Neutral" | "Mixed") + UNCERTAINTY:
   - Use "Mixed" when genuine contrasting positive AND negative opinions appear (e.g., "The food was excellent, but the service was terrible." or "I appreciate your help, but I disagree with your conclusion.").
   - Handle negation and double negatives/litotes accurately (e.g., "That was not bad at all." -> Positive; "I don't think this is a good idea." -> Negative).
   - Handle sarcasm/irony accurately (e.g., "Wow, another brilliant decision! Now everything is broken." -> Negative; "Brilliant, my train is delayed again." -> Negative).
   - Set uncertaintyLevel ("Low" | "Moderate" | "High") and uncertaintyReason when context is genuinely ambiguous or open to multiple interpretations.

2. COMMENT TYPES (1 to 3 labels strictly from):
   Compliment, Insult, Sarcasm, Complaint, Criticism, Praise, Suggestion, Recommendation, Question, Request, Appreciation, Gratitude, Apology, Agreement, Disagreement, Threat, Warning, Humor, Joke, Encouragement, Observation, Information, Persuasion, Other / Uncertain.
   - Distinguish polite disagreement ("I don't think this is a good idea.") from Insult.
   - Sarcastic praise over bad outcomes is ["Sarcasm", "Criticism"] or ["Sarcasm", "Complaint"], never Compliment.

3. TONE (strictly 1 label from):
   Friendly, Polite, Rude, Hostile, Angry, Frustrated, Happy, Sad, Excited, Disappointed, Respectful, Confident, Uncertain, Humorous, Sarcastic, Neutral.

4. EMOTION (strictly 1 label from):
   Joy, Anger, Sadness, Fear, Surprise, Disgust, Frustration, Excitement, Gratitude, Disappointment, Neutral, Other.

5. COMMUNICATION INTENT (strictly 1 label from):
   Expressing an opinion, Requesting help, Giving information, Making a suggestion, Complaining, Appreciating, Persuading, Warning, Criticizing, Asking a question, Apologizing, Other.

6. DYNAMIC ASPECT EXTRACTION (NO FIXED DOMAIN LIST):
   - Extract aspects only when a specific target/attribute is evaluated with an opinion.
   - NEVER extract pronouns (she, he, they, it, we, you, I, this, that) as aspectTerm.
   - If the target is a pronoun or implied (e.g., "She was beautiful."), set isImplicit: true, aspectTerm: null, aspectCategory: "Appearance", opinionExpression: "beautiful", sentiment: "Positive".
   - If no evaluated aspect exists (e.g., "Could you please help me?", "The meeting starts at 10 AM.", "Please stop sending me these messages."), return an empty aspects array []. Never invent aspects.

7. CONTEXT, SARCASM & WORD-LEVEL EXPLORER SPANS:
   - Evaluate sarcasmOrIrony ("Detected" | "Uncertain" | "Not Detected"), containsNegation, and containsDoubleNegative.
   - In keyExpressions, list exact verbatim substrings from the statement that carry clear analytical signal (positive_expression, negative_expression, sarcastic_expression, emotional_expression) with a concise classification and explanation. Only include spans you have high signal for; never pad with filler words.`;

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    required: [
      'statementId',
      'overallSentiment',
      'uncertaintyLevel',
      'explanation',
      'commentTypes',
      'tone',
      'emotion',
      'communicationIntent',
      'aspects',
      'keyExpressions',
      'detectedLanguage',
      'sarcasmOrIrony',
      'containsNegation',
      'containsDoubleNegative',
      'interpretation',
      'positiveExpressions',
      'negativeExpressions',
    ],
    properties: {
      statementId: { type: Type.STRING },
      overallSentiment: { type: Type.STRING },
      uncertaintyLevel: { type: Type.STRING },
      uncertaintyReason: { type: Type.STRING },
      explanation: { type: Type.STRING },
      commentTypes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      tone: { type: Type.STRING },
      emotion: { type: Type.STRING },
      communicationIntent: { type: Type.STRING },
      aspects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ['aspectCategory', 'isImplicit', 'opinionExpression', 'sentiment'],
          properties: {
            aspectTerm: { type: Type.STRING },
            aspectCategory: { type: Type.STRING },
            isImplicit: { type: Type.BOOLEAN },
            opinionExpression: { type: Type.STRING },
            sentiment: { type: Type.STRING },
          },
        },
      },
      keyExpressions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          required: ['phrase', 'category', 'classification', 'explanation'],
          properties: {
            phrase: { type: Type.STRING },
            category: { type: Type.STRING },
            classification: { type: Type.STRING },
            associatedAspect: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
        },
      },
      detectedLanguage: { type: Type.STRING },
      sarcasmOrIrony: { type: Type.STRING },
      sarcasmNote: { type: Type.STRING },
      containsNegation: { type: Type.BOOLEAN },
      containsDoubleNegative: { type: Type.BOOLEAN },
      negationNote: { type: Type.STRING },
      figurativeOrImplicitNote: { type: Type.STRING },
      interpretation: { type: Type.STRING },
      positiveExpressions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      negativeExpressions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
      ambiguityNote: { type: Type.STRING },
    },
  },
};

function sanitizeOptionalNote(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const t = val.trim();
  if (!t) return null;
  const lower = t.toLowerCase().replace(/\.$/, '');
  if (
    lower === 'none' ||
    lower === 'n/a' ||
    lower === 'null' ||
    lower === 'no ambiguity' ||
    lower === 'not applicable'
  ) {
    return null;
  }
  return t;
}

function normalizeOverallSentiment(raw: unknown): OverallSentiment {
  if (typeof raw !== 'string') return 'Neutral';
  const v = raw.trim().toLowerCase();
  if (v === 'positive') return 'Positive';
  if (v === 'negative') return 'Negative';
  if (v === 'mixed') return 'Mixed';
  return 'Neutral';
}

function normalizeAspectSentiment(raw: unknown): AspectSentiment {
  if (typeof raw !== 'string') return 'Neutral';
  const v = raw.trim().toLowerCase();
  if (v === 'positive') return 'Positive';
  if (v === 'negative') return 'Negative';
  return 'Neutral';
}

function normalizeSarcasm(raw: unknown): SarcasmStatus {
  if (typeof raw !== 'string') return 'Not Detected';
  const v = raw.trim().toLowerCase();
  if (v === 'detected' || v === 'yes' || v === 'true') return 'Detected';
  if (v === 'uncertain' || v === 'ambiguous' || v === 'possible') return 'Uncertain';
  return 'Not Detected';
}

function normalizeUncertainty(raw: unknown): UncertaintyLevel {
  if (typeof raw !== 'string') return 'Low';
  const v = raw.trim().toLowerCase();
  if (v === 'high') return 'High';
  if (v === 'moderate' || v === 'medium') return 'Moderate';
  return 'Low';
}

function matchFromEnumList(raw: unknown, allowedSet: Set<string>, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (allowedSet.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const candidate of allowedSet) {
    if (candidate.toLowerCase() === lower) return candidate;
  }
  return trimmed || fallback;
}

function normalizeCommentTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['Other / Uncertain'];
  const valid = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => matchFromEnumList(item, ALLOWED_COMMENT_SET, ''))
    .filter((item) => item.length > 0);

  if (valid.length > 0) {
    return Array.from(new Set(valid)).slice(0, 4);
  }
  return ['Other / Uncertain'];
}

function findSpanOffsets(
  text: string,
  term: string | null
): { startOffset: number; endOffset: number } {
  if (!term) return { startOffset: 0, endOffset: 0 };
  const exactIdx = text.indexOf(term);
  if (exactIdx !== -1) {
    return { startOffset: exactIdx, endOffset: exactIdx + term.length };
  }
  const lowerIdx = text.toLowerCase().indexOf(term.toLowerCase());
  if (lowerIdx !== -1) {
    return { startOffset: lowerIdx, endOffset: lowerIdx + term.length };
  }
  return { startOffset: 0, endOffset: 0 };
}

function sanitizeAspectTerm(rawTerm: unknown, isImplicit: boolean): string | null {
  if (isImplicit || typeof rawTerm !== 'string') return null;
  const trimmed = rawTerm.trim();
  if (!trimmed) return null;
  if (PRONOUN_BLOCKLIST.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

function normalizeSpanCategory(raw: unknown): SpanHighlightCategory {
  if (typeof raw !== 'string') return 'emotional_expression';
  const v = raw.trim().toLowerCase();
  if (v.includes('positive')) return 'positive_expression';
  if (v.includes('negative')) return 'negative_expression';
  if (v.includes('sarcas') || v.includes('iron')) return 'sarcastic_expression';
  if (v.includes('aspect')) return 'aspect';
  if (v.includes('negat')) return 'negation';
  return 'emotional_expression';
}

/**
 * Deterministic post-processing to build non-overlapping, verified character spans
 * for the Interactive Word-Level Explorer.
 */
function buildExplorerSpans(
  statementId: string,
  text: string,
  aspects: AnalyzedAspectOutput[],
  rawExpressions: Array<{
    phrase?: string;
    category?: string;
    classification?: string;
    associatedAspect?: string;
    explanation?: string;
  }>,
  containsNegation: boolean
): ExplorerSpan[] {
  const candidates: ExplorerSpan[] = [];

  // 1. Explicit aspect terms (highest priority grounded anchors)
  for (const asp of aspects) {
    if (!asp.isImplicit && asp.aspectTerm && asp.endOffset > asp.startOffset) {
      candidates.push({
        id: `${statementId}-span-asp-${asp.id}`,
        phrase: text.slice(asp.startOffset, asp.endOffset),
        category: 'aspect',
        classification: `Aspect (${asp.aspectCategory}) · ${asp.sentiment}`,
        associatedAspect: asp.aspectCategory,
        explanation: `Explicit target "${asp.aspectTerm}" evaluated via "${asp.opinionExpression}" (${asp.sentiment}).`,
        attributionSource: 'Verified Span Match',
        startOffset: asp.startOffset,
        endOffset: asp.endOffset,
      });
    }
  }

  // 2. Deterministic negation cue detection when negation is present or matched verbatim
  NEGATION_WORD_REGEX.lastIndex = 0;
  let negMatch: RegExpExecArray | null;
  let negIdx = 0;
  while ((negMatch = NEGATION_WORD_REGEX.exec(text)) !== null) {
    negIdx += 1;
    const phrase = negMatch[0];
    const startOffset = negMatch.index;
    const endOffset = startOffset + phrase.length;
    candidates.push({
      id: `${statementId}-span-neg-${negIdx}`,
      phrase,
      category: 'negation',
      classification: 'Negation Cue',
      associatedAspect: null,
      explanation: containsNegation
        ? 'Negation marker modifying clause polarity or scoping sentiment reversal.'
        : 'Lexical negation marker evaluated in statement context.',
      attributionSource: 'Verified Span Match',
      startOffset,
      endOffset,
    });
  }

  // 3. Model-identified key expressions verified to appear verbatim in originalText
  rawExpressions.forEach((expr, idx) => {
    if (typeof expr.phrase !== 'string' || !expr.phrase.trim()) return;
    const offsets = findSpanOffsets(text, expr.phrase.trim());
    if (offsets.endOffset <= offsets.startOffset) return;

    const category = normalizeSpanCategory(expr.category);
    const actualPhrase = text.slice(offsets.startOffset, offsets.endOffset);
    candidates.push({
      id: `${statementId}-span-expr-${idx + 1}`,
      phrase: actualPhrase,
      category,
      classification:
        typeof expr.classification === 'string' && expr.classification.trim()
          ? expr.classification.trim()
          : category.replace(/_/g, ' '),
      associatedAspect: sanitizeOptionalNote(expr.associatedAspect),
      explanation:
        typeof expr.explanation === 'string' && expr.explanation.trim()
          ? expr.explanation.trim()
          : 'Contextual sentiment or pragmatic signal identified by the inference model.',
      attributionSource: 'Model Attribution',
      startOffset: offsets.startOffset,
      endOffset: offsets.endOffset,
    });
  });

  // Sort by startOffset ascending, preferring shorter/verified spans first on ties so aspects & negations win
  candidates.sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    if (a.attributionSource !== b.attributionSource) {
      return a.attributionSource === 'Verified Span Match' ? -1 : 1;
    }
    return a.endOffset - a.startOffset - (b.endOffset - b.startOffset);
  });

  // Deduplicate overlapping spans cleanly
  const accepted: ExplorerSpan[] = [];
  for (const cand of candidates) {
    const overlaps = accepted.some(
      (existing) =>
        cand.startOffset < existing.endOffset && cand.endOffset > existing.startOffset
    );
    if (!overlaps) {
      accepted.push(cand);
    }
  }

  return accepted;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Inference request timed out after ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface RawGeminiStatementResult {
  statementId?: string;
  overallSentiment?: string;
  uncertaintyLevel?: string;
  uncertaintyReason?: string;
  explanation?: string;
  commentTypes?: unknown;
  tone?: string;
  emotion?: string;
  communicationIntent?: string;
  aspects?: Array<{
    aspectTerm?: string;
    aspectCategory?: string;
    isImplicit?: boolean;
    opinionExpression?: string;
    sentiment?: string;
  }>;
  keyExpressions?: Array<{
    phrase?: string;
    category?: string;
    classification?: string;
    associatedAspect?: string;
    explanation?: string;
  }>;
  detectedLanguage?: string;
  sarcasmOrIrony?: string;
  sarcasmNote?: string;
  containsNegation?: boolean;
  containsDoubleNegative?: boolean;
  negationNote?: string;
  figurativeOrImplicitNote?: string;
  interpretation?: string;
  positiveExpressions?: unknown;
  negativeExpressions?: unknown;
  ambiguityNote?: string;
}

export class GeminiNlpInferenceProvider implements StatementInferenceProvider {
  public readonly providerName = `Google Gemini API (${GEMINI_MODEL})`;
  public readonly isApiBased = true;

  public isAvailable(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
  }

  public getClient(): GoogleGenAI {
    if (!this.isAvailable()) {
      throw new Error(
        'Server inference credentials (GEMINI_API_KEY) are not configured. Set GEMINI_API_KEY in Settings > Secrets.'
      );
    }
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  private async runChunk(
    ai: GoogleGenAI,
    chunk: BatchStatementInput[]
  ): Promise<StatementAnalysisOutput[]> {
    let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const requestPromise = ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            'Analyze each statement in the JSON array below and preserve each statementId.',
            JSON.stringify(
              chunk.map((item) => ({ statementId: item.statementId, text: item.text }))
            ),
          ].join('\n\n'),
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        });
        response = await withTimeout(requestPromise, REQUEST_TIMEOUT_MS);
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('RESOURCE_EXHAUSTED');
        if (!isTransient || attempt === 2) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }

    if (!response) {
      throw lastError instanceof Error
        ? lastError
        : new Error('Inference provider failed to return a response.');
    }
    const rawJson = (response.text ?? '').trim();

    if (!rawJson) {
      throw new Error('Inference provider returned an empty response.');
    }

    let parsed: RawGeminiStatementResult[];
    try {
      parsed = JSON.parse(rawJson) as RawGeminiStatementResult[];
    } catch {
      throw new Error('Inference provider returned malformed JSON output.');
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Inference provider returned an unexpected response structure.');
    }

    const inputById = new Map(chunk.map((item) => [item.statementId, item]));
    const outputById = new Map<string, StatementAnalysisOutput>();

    for (let idx = 0; idx < parsed.length; idx += 1) {
      const item = parsed[idx];
      const matchedInput =
        (item.statementId && inputById.get(item.statementId)) ?? chunk[idx];
      if (!matchedInput) continue;

      const rawAspects = Array.isArray(item.aspects) ? item.aspects : [];
      const cleanedAspects: AnalyzedAspectOutput[] = [];

      for (let aIdx = 0; aIdx < rawAspects.length; aIdx += 1) {
        const rawAsp = rawAspects[aIdx];
        const category =
          typeof rawAsp.aspectCategory === 'string' && rawAsp.aspectCategory.trim()
            ? rawAsp.aspectCategory.trim()
            : '';
        const opinion =
          typeof rawAsp.opinionExpression === 'string' && rawAsp.opinionExpression.trim()
            ? rawAsp.opinionExpression.trim()
            : '';

        if (!category && !opinion) continue;

        let isImplicit = Boolean(rawAsp.isImplicit);
        let term = sanitizeAspectTerm(rawAsp.aspectTerm, isImplicit);
        if (!term) {
          isImplicit = true;
        }

        const offsets = findSpanOffsets(matchedInput.text, term);
        if (term && offsets.endOffset > offsets.startOffset) {
          term = matchedInput.text.slice(offsets.startOffset, offsets.endOffset);
        } else if (term && offsets.endOffset === 0) {
          // Term was not found verbatim in original text -> treat as implicit aspect category
          term = null;
          isImplicit = true;
        }

        cleanedAspects.push({
          id: `${matchedInput.statementId}-asp-${aIdx + 1}`,
          aspectTerm: term,
          aspectCategory: category || term || 'General',
          isImplicit,
          opinionExpression: opinion || '--',
          sentiment: normalizeAspectSentiment(rawAsp.sentiment),
          startOffset: offsets.startOffset,
          endOffset: offsets.endOffset,
        });
      }

      const emotion = matchFromEnumList(item.emotion, ALLOWED_EMOTION_SET, 'Neutral');
      const tone = matchFromEnumList(item.tone, ALLOWED_TONE_SET, 'Neutral');
      const communicationIntent = matchFromEnumList(
        item.communicationIntent,
        ALLOWED_INTENT_SET,
        'Other'
      );

      const containsNegation = Boolean(item.containsNegation);
      const containsDoubleNegative = Boolean(item.containsDoubleNegative);
      const rawExpressions = Array.isArray(item.keyExpressions) ? item.keyExpressions : [];
      const highlightedSpans = buildExplorerSpans(
        matchedInput.statementId,
        matchedInput.text,
        cleanedAspects,
        rawExpressions,
        containsNegation
      );

      outputById.set(matchedInput.statementId, {
        statementId: matchedInput.statementId,
        speaker: matchedInput.speaker ?? null,
        timestamp: matchedInput.timestamp ?? null,
        originalText: matchedInput.text,
        overallSentiment: normalizeOverallSentiment(item.overallSentiment),
        uncertaintyLevel: normalizeUncertainty(item.uncertaintyLevel),
        uncertaintyReason: sanitizeOptionalNote(item.uncertaintyReason),
        explanation:
          typeof item.explanation === 'string' && item.explanation.trim()
            ? item.explanation.trim()
            : 'Analyzed based on lexical and contextual sentiment cues.',
        commentTypes: normalizeCommentTypes(item.commentTypes),
        tone,
        emotion,
        primaryEmotion: emotion === 'Neutral' ? null : emotion,
        communicationIntent,
        aspects: cleanedAspects,
        highlightedSpans,
        languageAnalysis: {
          detectedLanguage:
            typeof item.detectedLanguage === 'string' && item.detectedLanguage.trim()
              ? item.detectedLanguage.trim()
              : 'English',
          sarcasmOrIrony: normalizeSarcasm(item.sarcasmOrIrony),
          sarcasmNote: sanitizeOptionalNote(item.sarcasmNote),
          containsNegation,
          containsDoubleNegative,
          negationNote: sanitizeOptionalNote(item.negationNote),
          figurativeOrImplicitNote: sanitizeOptionalNote(item.figurativeOrImplicitNote),
          confidenceScore: null,
          confidenceStatus: 'Confidence not calibrated (API LLM)',
        },
        insights: {
          interpretation:
            typeof item.interpretation === 'string' && item.interpretation.trim()
              ? item.interpretation.trim()
              : typeof item.explanation === 'string'
              ? item.explanation.trim()
              : '',
          positiveExpressions: Array.isArray(item.positiveExpressions)
            ? item.positiveExpressions.filter(
                (x): x is string => typeof x === 'string' && x.trim().length > 0
              )
            : [],
          negativeExpressions: Array.isArray(item.negativeExpressions)
            ? item.negativeExpressions.filter(
                (x): x is string => typeof x === 'string' && x.trim().length > 0
              )
            : [],
          ambiguityNote: sanitizeOptionalNote(item.ambiguityNote),
        },
      });
    }

    return chunk.map((input) => {
      const found = outputById.get(input.statementId);
      if (!found) {
        throw new Error(`Missing analysis result for statement ${input.statementId}.`);
      }
      return found;
    });
  }

  public async analyzeStatement(
    statementId: string,
    text: string
  ): Promise<StatementAnalysisOutput> {
    const [result] = await this.analyzeBatch([{ statementId, text }]);
    return result;
  }

  public async analyzeBatch(
    inputs: BatchStatementInput[]
  ): Promise<StatementAnalysisOutput[]> {
    const ai = this.getClient();
    const results: StatementAnalysisOutput[] = [];

    for (let i = 0; i < inputs.length; i += BATCH_CHUNK_SIZE) {
      const chunk = inputs.slice(i, i + BATCH_CHUNK_SIZE);
      const chunkResults = await this.runChunk(ai, chunk);
      results.push(...chunkResults);
    }

    return results;
  }
}

export const defaultStatementProvider = new GeminiNlpInferenceProvider();
