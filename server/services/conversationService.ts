import { Type } from '@google/genai';
import { defaultStatementProvider } from './geminiNlpProvider.ts';
import type {
  ConversationAnalysisResult,
  ConversationMessageAnalysis,
  ConversationMessageInput,
  OverallSentiment,
} from './inferenceProvider.ts';

const GEMINI_MODEL = 'gemini-3.1-flash-lite';

const CONVERSATION_SYNTHESIS_SCHEMA = {
  type: Type.OBJECT,
  required: [
    'overallSummary',
    'sentimentTrendSummary',
    'emotionalToneShifts',
    'repeatedTopics',
    'mainPositiveSubjects',
    'mainNegativeSubjects',
    'disagreementPoints',
  ],
  properties: {
    overallSummary: { type: Type.STRING },
    sentimentTrendSummary: { type: Type.STRING },
    emotionalToneShifts: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    repeatedTopics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['topic', 'mentionCount', 'dominantSentiment'],
        properties: {
          topic: { type: Type.STRING },
          mentionCount: { type: Type.INTEGER },
          dominantSentiment: { type: Type.STRING },
        },
      },
    },
    mainPositiveSubjects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    mainNegativeSubjects: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    disagreementPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
};

function sentimentToTrendScore(sentiment: OverallSentiment): number {
  if (sentiment === 'Positive') return 1;
  if (sentiment === 'Negative') return -1;
  return 0;
}

function normalizeSentiment(raw: unknown): OverallSentiment {
  if (typeof raw !== 'string') return 'Neutral';
  const v = raw.trim().toLowerCase();
  if (v === 'positive') return 'Positive';
  if (v === 'negative') return 'Negative';
  if (v === 'mixed') return 'Mixed';
  return 'Neutral';
}

export async function analyzeConversationMessages(params: {
  title: string;
  messages: ConversationMessageInput[];
}): Promise<ConversationAnalysisResult> {
  const startedAt = performance.now();
  const hasExplicitSpeakers = params.messages.some(
    (m) => typeof m.speaker === 'string' && m.speaker.trim().length > 0
  );

  // 1. Analyze every message independently via the domain-independent statement engine
  const perMessageResults = await defaultStatementProvider.analyzeBatch(
    params.messages.map((m) => ({
      statementId: m.messageId,
      text: m.text,
      speaker: m.speaker,
      timestamp: m.timestamp,
    }))
  );

  const messages: ConversationMessageAnalysis[] = perMessageResults.map((res, idx) => ({
    messageId: res.statementId,
    index: idx + 1,
    speaker: params.messages[idx]?.speaker?.trim() || null,
    timestamp: params.messages[idx]?.timestamp?.trim() || null,
    text: res.originalText,
    sentiment: res.overallSentiment,
    sentimentTrendScore: sentimentToTrendScore(res.overallSentiment),
    commentTypes: res.commentTypes,
    tone: res.tone,
    emotion: res.emotion,
    communicationIntent: res.communicationIntent,
    aspects: res.aspects,
    sarcasmOrIrony: res.languageAnalysis.sarcasmOrIrony,
    explanation: res.explanation,
  }));

  // 2. Collective conversation-level synthesis
  const ai = defaultStatementProvider.getClient();
  const digest = messages.map((m) => ({
    index: m.index,
    speaker: m.speaker ?? 'Unspecified',
    timestamp: m.timestamp ?? undefined,
    text: m.text,
    sentiment: m.sentiment,
    tone: m.tone,
    emotion: m.emotion,
    commentTypes: m.commentTypes,
    aspects: m.aspects.map((a) => `${a.aspectCategory}:${a.sentiment}`),
  }));

  const synthesisResp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      'Analyze this chronological conversation objectively.',
      'Do NOT invent speaker identities if speaker is "Unspecified".',
      'Do NOT assume sentiment shifts prove a person’s true psychological or internal emotional state; describe observable textual shifts only.',
      JSON.stringify(digest),
    ].join('\n\n'),
    config: {
      systemInstruction:
        'You synthesize chronological multi-message conversations into factual topic, trend, subject, and disagreement summaries without inventing unstated speakers or psychological diagnoses.',
      responseMimeType: 'application/json',
      responseSchema: CONVERSATION_SYNTHESIS_SCHEMA,
    },
  });

  const rawJson = (synthesisResp.text ?? '').trim();
  let synthesis: {
    overallSummary?: string;
    sentimentTrendSummary?: string;
    emotionalToneShifts?: string[];
    repeatedTopics?: Array<{
      topic?: string;
      mentionCount?: number;
      dominantSentiment?: string;
    }>;
    mainPositiveSubjects?: string[];
    mainNegativeSubjects?: string[];
    disagreementPoints?: string[];
  } = {};

  try {
    synthesis = JSON.parse(rawJson);
  } catch {
    synthesis = {
      overallSummary: `Analyzed ${messages.length} chronological messages.`,
      sentimentTrendSummary: 'Trend derived from message-level polarity sequence.',
    };
  }

  const processingTimeMs = Number((performance.now() - startedAt).toFixed(2));

  return {
    conversationId: `CONV-${Date.now()}`,
    title: params.title,
    analyzedAt: new Date().toISOString(),
    totalMessages: messages.length,
    hasExplicitSpeakers,
    providerName: defaultStatementProvider.providerName,
    isApiBased: defaultStatementProvider.isApiBased,
    processingTimeMs,
    overallSummary:
      typeof synthesis.overallSummary === 'string' && synthesis.overallSummary.trim()
        ? synthesis.overallSummary.trim()
        : `Analyzed ${messages.length} chronological messages.`,
    sentimentTrendSummary:
      typeof synthesis.sentimentTrendSummary === 'string' && synthesis.sentimentTrendSummary.trim()
        ? synthesis.sentimentTrendSummary.trim()
        : 'Computed from chronological message sentiments.',
    emotionalToneShifts: Array.isArray(synthesis.emotionalToneShifts)
      ? synthesis.emotionalToneShifts.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    repeatedTopics: Array.isArray(synthesis.repeatedTopics)
      ? synthesis.repeatedTopics
          .filter((t) => typeof t?.topic === 'string' && t.topic.trim().length > 0)
          .map((t) => ({
            topic: t.topic!.trim(),
            mentionCount: typeof t.mentionCount === 'number' && t.mentionCount > 0 ? t.mentionCount : 1,
            dominantSentiment: normalizeSentiment(t.dominantSentiment),
          }))
      : [],
    mainPositiveSubjects: Array.isArray(synthesis.mainPositiveSubjects)
      ? synthesis.mainPositiveSubjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    mainNegativeSubjects: Array.isArray(synthesis.mainNegativeSubjects)
      ? synthesis.mainNegativeSubjects.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    disagreementPoints: Array.isArray(synthesis.disagreementPoints)
      ? synthesis.disagreementPoints.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [],
    disclaimer:
      'Observed tone and sentiment transitions reflect textual phrasing in each message only and do not establish any speaker’s true internal emotional state.',
    messages,
  };
}
