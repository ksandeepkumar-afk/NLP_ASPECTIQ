import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeClassificationMetrics,
  computeSpanExtractionMetrics,
} from '../evaluation/metrics.ts';
import { trainAndEvaluateTfidfLogisticRegression } from '../models/tfidfLogisticRegression.ts';
import { computeBatchAggregations } from '../routes/absaRoutes.ts';
import type { StatementAnalysisOutput } from '../services/inferenceProvider.ts';
import { historyDb } from '../storage/database.ts';
import { DashboardSection } from '../../src/types/absa.ts';
import {
  getPathForRoute,
  MODULE_PATHS,
  parseRouteFromLocation,
} from '../../src/utils/navigation.ts';

test('computeClassificationMetrics computes exact accuracy, macro P/R/F1, and confusion matrix', () => {
  const yTrue = ['Positive', 'Positive', 'Negative', 'Negative', 'Neutral', 'Neutral'];
  const yPred = ['Positive', 'Negative', 'Negative', 'Negative', 'Neutral', 'Positive'];

  const report = computeClassificationMetrics(yTrue, yPred, ['Positive', 'Negative', 'Neutral']);

  // 4/6 = 66.67%
  assert.equal(report.accuracy, 66.67);
  assert.deepEqual(report.confusionMatrix, [
    [1, 1, 0], // True Positive: 1 pred Pos, 1 pred Neg
    [0, 2, 0], // True Negative: 2 pred Neg
    [1, 0, 1], // True Neutral: 1 pred Pos, 1 pred Neu
  ]);
  assert.ok(report.precisionMacro > 0 && report.precisionMacro <= 100);
  assert.ok(report.recallMacro > 0 && report.recallMacro <= 100);
  assert.ok(report.f1Macro > 0 && report.f1Macro <= 100);
});

test('computeSpanExtractionMetrics computes aspect span precision, recall, and F1', () => {
  const gold = [
    ['camera', 'battery'],
    ['food quality', 'service'],
  ];
  const pred = [
    ['Camera', 'display'], // 1 TP ('camera'), 1 FP ('display'), 1 FN ('battery')
    ['food quality', 'service'], // 2 TP, 0 FP, 0 FN
  ];

  const metrics = computeSpanExtractionMetrics(gold, pred);
  // Total TP = 3, FP = 1, FN = 1 -> P=75.00, R=75.00, F1=75.00
  assert.equal(metrics.precision, 75);
  assert.equal(metrics.recall, 75);
  assert.equal(metrics.f1Score, 75);
});

test('trainAndEvaluateTfidfLogisticRegression trains on labeled split and rejects tiny datasets', () => {
  assert.throws(
    () =>
      trainAndEvaluateTfidfLogisticRegression({
        datasetName: 'Too Small',
        samples: [
          { text: 'Great camera', label: 'Positive' },
          { text: 'Bad battery', label: 'Negative' },
        ],
      }),
    /At least 10 valid labeled samples/
  );

  const samples = [
    { text: 'The camera quality is crisp and vibrant outdoors.', label: 'Positive' },
    { text: 'Fast charging and brilliant bright screen display.', label: 'Positive' },
    { text: 'Fresh delicious food with super attentive service.', label: 'Positive' },
    { text: 'Lightweight chassis and comfortable keyboard feel.', label: 'Positive' },
    { text: 'Clear explanation and helpful detailed guidance.', label: 'Positive' },
    { text: 'Battery drains quickly and heats up constantly.', label: 'Negative' },
    { text: 'Slow kitchen service and cold overpriced meals.', label: 'Negative' },
    { text: 'Screen glare and broken Wi-Fi after update.', label: 'Negative' },
    { text: 'Mushy keyboard keys and distorted speakers.', label: 'Negative' },
    { text: 'Rude support staff ignored my ticket for days.', label: 'Negative' },
    { text: 'The meeting starts at 10 AM in room B.', label: 'Neutral' },
    { text: 'Package arrived on Tuesday in brown cardboard.', label: 'Neutral' },
    { text: 'Available in silver with 256 GB storage.', label: 'Neutral' },
    { text: 'Store hours run from nine to six weekdays.', label: 'Neutral' },
    { text: 'This laptop weighs 1.3 kg with USB-C.', label: 'Neutral' },
  ];

  const record = trainAndEvaluateTfidfLogisticRegression({
    datasetName: 'Unit Test Sentiment Split',
    samples,
    epochs: 30,
  });

  assert.equal(record.datasetSize, 15);
  assert.equal(record.trainSize + record.testSize, 15);
  assert.ok(record.testSize >= 3);
  assert.ok(record.lossHistory.length >= 2);
  assert.ok(
    record.lossHistory[record.lossHistory.length - 1].trainLoss <=
      record.lossHistory[0].trainLoss
  );

  const matrixSum = record.confusionMatrix
    .flat()
    .reduce((acc, v) => acc + v, 0);
  assert.equal(matrixSum, record.testSize);
});

test('computeBatchAggregations summarizes sentiment, sarcasm, negation, and aspects accurately', () => {
  const sampleOutputs: StatementAnalysisOutput[] = [
    {
      analysisId: 'T1',
      statementId: 'S1',
      originalText: 'Lightweight laptop, poor battery.',
      overallSentiment: 'Mixed',
      uncertaintyLevel: 'Low',
      uncertaintyReason: null,
      explanation: 'Mixed praise and complaint.',
      commentTypes: ['Product Review', 'Complaint'],
      tone: 'Analytical',
      emotion: 'Frustration',
      primaryEmotion: 'Frustration',
      communicationIntent: 'Evaluate',
      aspects: [
        {
          id: 'A1',
          aspectTerm: 'laptop',
          aspectCategory: 'Build / Portability',
          isImplicit: false,
          opinionExpression: 'Lightweight',
          sentiment: 'Positive',
          startOffset: 0,
          endOffset: 11,
        },
        {
          id: 'A2',
          aspectTerm: 'battery',
          aspectCategory: 'Battery',
          isImplicit: false,
          opinionExpression: 'poor',
          sentiment: 'Negative',
          startOffset: 20,
          endOffset: 27,
        },
      ],
      highlightedSpans: [],
      languageAnalysis: {
        detectedLanguage: 'English',
        sarcasmOrIrony: 'Not Detected',
        sarcasmNote: null,
        containsNegation: false,
        containsDoubleNegative: false,
        negationNote: null,
        figurativeOrImplicitNote: null,
        confidenceScore: null,
        confidenceStatus: 'Confidence not calibrated (API LLM)',
      },
      insights: {
        interpretation: 'Mixed product review.',
        positiveExpressions: ['Lightweight'],
        negativeExpressions: ['poor'],
        ambiguityNote: null,
      },
    },
    {
      analysisId: 'T2',
      statementId: 'S2',
      originalText: 'Wow, not bad at all.',
      overallSentiment: 'Positive',
      uncertaintyLevel: 'Moderate',
      uncertaintyReason: 'Litotes expression.',
      explanation: 'Negated negative indicates positive approval.',
      commentTypes: ['Compliment'],
      tone: 'Playful',
      emotion: 'Satisfaction',
      primaryEmotion: 'Satisfaction',
      communicationIntent: 'Praise',
      aspects: [],
      highlightedSpans: [],
      languageAnalysis: {
        detectedLanguage: 'English',
        sarcasmOrIrony: 'Detected',
        sarcasmNote: 'Playful understatement.',
        containsNegation: true,
        containsDoubleNegative: false,
        negationNote: 'Negation ("not bad") yields positive sentiment.',
        figurativeOrImplicitNote: 'Litotes',
        confidenceScore: null,
        confidenceStatus: 'Confidence not calibrated (API LLM)',
      },
      insights: {
        interpretation: 'Positive understatement.',
        positiveExpressions: ['not bad at all'],
        negativeExpressions: [],
        ambiguityNote: null,
      },
    },
  ];

  const agg = computeBatchAggregations(sampleOutputs);
  assert.equal(agg.totalStatementsAnalyzed, 2);
  assert.equal(agg.totalAspectsExtracted, 2);
  assert.equal(agg.sentimentCounts.Mixed, 1);
  assert.equal(agg.sentimentCounts.Positive, 1);
  assert.equal(agg.sarcasmDetectedCount, 1);
  assert.equal(agg.negationCount, 1);
  assert.equal(agg.mostPositiveAspects[0].aspectCategory, 'Build / Portability');
  assert.equal(agg.mostNegativeAspects[0].aspectCategory, 'Battery');
});

test('historyDb persists, queries, and deletes statement analyses cleanly', () => {
  const testId = `TEST-STMT-${Date.now()}`;
  const sample: StatementAnalysisOutput = {
    analysisId: testId,
    statementId: testId,
    originalText: 'Unique unit test verification sentence for AspectIQ SQLite repository.',
    overallSentiment: 'Neutral',
    uncertaintyLevel: 'Low',
    uncertaintyReason: null,
    explanation: 'Test record.',
    commentTypes: ['Factual Statement'],
    tone: 'Neutral',
    emotion: 'Neutral / None',
    primaryEmotion: null,
    communicationIntent: 'Inform',
    aspects: [],
    highlightedSpans: [],
    languageAnalysis: {
      detectedLanguage: 'English',
      sarcasmOrIrony: 'Not Detected',
      sarcasmNote: null,
      containsNegation: false,
      containsDoubleNegative: false,
      negationNote: null,
      figurativeOrImplicitNote: null,
      confidenceScore: null,
      confidenceStatus: 'Confidence not calibrated (API LLM)',
    },
    insights: {
      interpretation: 'Factual statement.',
      positiveExpressions: [],
      negativeExpressions: [],
      ambiguityNote: null,
    },
  };

  historyDb.saveStatementAnalysis(testId, sample);

  const list = historyDb.listHistory({ search: 'Unique unit test verification' });
  assert.ok(list.some((item) => item.id === testId));

  const payload = historyDb.getHistoryPayload(testId);
  assert.ok(payload !== null);
  assert.equal(payload.sourceType, 'statement');

  const deleted = historyDb.deleteHistory(testId);
  assert.equal(deleted, true);

  const afterDelete = historyDb.getHistoryPayload(testId);
  assert.equal(afterDelete, null);
});

test('three-layer navigation parser maps welcome, workspace, and all six module paths cleanly', () => {
  assert.deepEqual(parseRouteFromLocation('/'), {
    layer: 'welcome',
    section: DashboardSection.Workbench,
  });
  assert.deepEqual(parseRouteFromLocation('/workspace'), {
    layer: 'workspace',
    section: DashboardSection.Workbench,
  });
  assert.deepEqual(parseRouteFromLocation('/workspace/'), {
    layer: 'workspace',
    section: DashboardSection.Workbench,
  });

  for (const [section, path] of Object.entries(MODULE_PATHS) as Array<[DashboardSection, string]>) {
    const parsed = parseRouteFromLocation(path);
    assert.deepEqual(parsed, { layer: 'module', section });
    assert.equal(getPathForRoute(parsed), path);
    assert.deepEqual(parseRouteFromLocation(`${path}/`), { layer: 'module', section });
  }

  assert.equal(
    getPathForRoute({ layer: 'welcome', section: DashboardSection.Analytics }),
    '/'
  );
  assert.equal(
    getPathForRoute({ layer: 'workspace', section: DashboardSection.Analytics }),
    '/workspace'
  );
  assert.deepEqual(parseRouteFromLocation('/nonexistent/route'), {
    layer: 'welcome',
    section: DashboardSection.Workbench,
  });
});
