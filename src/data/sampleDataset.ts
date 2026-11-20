import {
  ArchitectureComponentDoc,
  AspectAggregateRow,
  AspectSpanPrediction,
  EvaluationState,
  ModelArchitectureSpec,
  PredictionSource,
  ReviewDomain,
  SampleReviewRecord,
  SentimentPolarity,
} from '../types/absa';

function createSampleAspect(
  reviewText: string,
  id: string,
  aspectTerm: string,
  aspectCategory: string,
  polarity: SentimentPolarity
): AspectSpanPrediction {
  const startOffset = reviewText.indexOf(aspectTerm);
  return {
    id,
    aspectTerm,
    aspectCategory,
    polarity,
    startOffset: startOffset === -1 ? 0 : startOffset,
    endOffset: startOffset === -1 ? 0 : startOffset + aspectTerm.length,
    confidenceScore: null,
  };
}

function createSampleReview(params: {
  id: string;
  domain: ReviewDomain;
  productOrVenue: string;
  reviewText: string;
  createdAt: string;
  aspects: Array<{
    id: string;
    aspectTerm: string;
    aspectCategory: string;
    polarity: SentimentPolarity;
  }>;
}): SampleReviewRecord {
  return {
    id: params.id,
    domain: params.domain,
    productOrVenue: params.productOrVenue,
    reviewText: params.reviewText,
    createdAt: params.createdAt,
    isSampleData: true,
    prediction: {
      source: PredictionSource.SamplePreview,
      modelIdentifier: 'Sample Reference Annotation (Not Live Inference)',
      inferenceLatencyMs: null,
      aspects: params.aspects.map((a) =>
        createSampleAspect(params.reviewText, a.id, a.aspectTerm, a.aspectCategory, a.polarity)
      ),
    },
    explanation: {
      source: 'GeminiExplanationLayer',
      status: 'not_connected',
      summary: null,
      rationaleByAspect: [],
      disclaimer:
        'Gemini explanation generation is decoupled from ML predictions and will be enabled in the explanation service integration phase.',
    },
  };
}

/**
 * SAMPLE PREVIEW DATASET
 * Every record below is static illustrative sample data modeled on SemEval-2014
 * domains (Electronics / Restaurants) to demonstrate dashboard layout and
 * aspect-span structures. These are NOT live ML model predictions.
 */
export const SAMPLE_REVIEWS: SampleReviewRecord[] = [
  createSampleReview({
    id: 'SMP-EL-101',
    domain: ReviewDomain.Electronics,
    productOrVenue: 'Lumina X14 Flagship Phone',
    reviewText:
      'The camera captures sharp low-light portraits, though battery endurance drops noticeably after 5 hours of navigation and the OLED display gets dim outdoors.',
    createdAt: '2026-10-14',
    aspects: [
      {
        id: 'asp-101-1',
        aspectTerm: 'camera',
        aspectCategory: 'Camera',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-101-2',
        aspectTerm: 'battery endurance',
        aspectCategory: 'Battery',
        polarity: SentimentPolarity.Negative,
      },
      {
        id: 'asp-101-3',
        aspectTerm: 'OLED display',
        aspectCategory: 'Display',
        polarity: SentimentPolarity.Negative,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-RS-102',
    domain: ReviewDomain.Restaurants,
    productOrVenue: 'Bistro Marais',
    reviewText:
      'Food quality was consistently fresh with balanced spices, and table service remained attentive despite the Friday rush, while menu pricing felt standard for downtown.',
    createdAt: '2026-10-15',
    aspects: [
      {
        id: 'asp-102-1',
        aspectTerm: 'Food quality',
        aspectCategory: 'Food Quality',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-102-2',
        aspectTerm: 'table service',
        aspectCategory: 'Service',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-102-3',
        aspectTerm: 'menu pricing',
        aspectCategory: 'Pricing',
        polarity: SentimentPolarity.Neutral,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-EL-103',
    domain: ReviewDomain.Electronics,
    productOrVenue: 'ZenBook Pro 14 Studio',
    reviewText:
      'The 120Hz display is color-accurate for editing, battery lasts through a full seminar day, and the aluminum chassis feels solid without extra weight.',
    createdAt: '2026-10-16',
    aspects: [
      {
        id: 'asp-103-1',
        aspectTerm: '120Hz display',
        aspectCategory: 'Display',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-103-2',
        aspectTerm: 'battery',
        aspectCategory: 'Battery',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-103-3',
        aspectTerm: 'aluminum chassis',
        aspectCategory: 'Build Quality',
        polarity: SentimentPolarity.Positive,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-RS-104',
    domain: ReviewDomain.Restaurants,
    productOrVenue: 'Harbor Noodle House',
    reviewText:
      'Broth and handmade noodles had great texture, however slow kitchen service meant waiting forty minutes and cramped seating made conversation difficult.',
    createdAt: '2026-10-18',
    aspects: [
      {
        id: 'asp-104-1',
        aspectTerm: 'Broth and handmade noodles',
        aspectCategory: 'Food Quality',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-104-2',
        aspectTerm: 'kitchen service',
        aspectCategory: 'Service',
        polarity: SentimentPolarity.Negative,
      },
      {
        id: 'asp-104-3',
        aspectTerm: 'seating',
        aspectCategory: 'Ambience',
        polarity: SentimentPolarity.Negative,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-EL-105',
    domain: ReviewDomain.Electronics,
    productOrVenue: 'Aperture S24 Ultra',
    reviewText:
      'Telephoto camera lens produces crisp zoom shots and display brightness holds up well in noon sun, though speaker clarity at max volume is average.',
    createdAt: '2026-10-19',
    aspects: [
      {
        id: 'asp-105-1',
        aspectTerm: 'Telephoto camera lens',
        aspectCategory: 'Camera',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-105-2',
        aspectTerm: 'display brightness',
        aspectCategory: 'Display',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-105-3',
        aspectTerm: 'speaker clarity',
        aspectCategory: 'Audio',
        polarity: SentimentPolarity.Neutral,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-RS-106',
    domain: ReviewDomain.Restaurants,
    productOrVenue: 'Saffron Courtyard',
    reviewText:
      'Service staff greeted us promptly and dining ambience was quiet enough for discussion, yet the signature curry arrived lukewarm and dessert portions felt small.',
    createdAt: '2026-10-20',
    aspects: [
      {
        id: 'asp-106-1',
        aspectTerm: 'Service staff',
        aspectCategory: 'Service',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-106-2',
        aspectTerm: 'dining ambience',
        aspectCategory: 'Ambience',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-106-3',
        aspectTerm: 'signature curry',
        aspectCategory: 'Food Quality',
        polarity: SentimentPolarity.Negative,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-EL-107',
    domain: ReviewDomain.Electronics,
    productOrVenue: 'Cobalt Note 12',
    reviewText:
      'Battery charging completes in under 40 minutes, camera night mode struggles with moving subjects, and the retail price sits in line with mid-tier rivals.',
    createdAt: '2026-10-21',
    aspects: [
      {
        id: 'asp-107-1',
        aspectTerm: 'Battery charging',
        aspectCategory: 'Battery',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-107-2',
        aspectTerm: 'camera night mode',
        aspectCategory: 'Camera',
        polarity: SentimentPolarity.Negative,
      },
      {
        id: 'asp-107-3',
        aspectTerm: 'retail price',
        aspectCategory: 'Pricing',
        polarity: SentimentPolarity.Neutral,
      },
    ],
  }),
  createSampleReview({
    id: 'SMP-RS-108',
    domain: ReviewDomain.Restaurants,
    productOrVenue: 'Veranda Grill',
    reviewText:
      'Wood-fired salmon and seasonal sides showed careful food quality, though bar service took two reminders for water refills.',
    createdAt: '2026-10-22',
    aspects: [
      {
        id: 'asp-108-1',
        aspectTerm: 'food quality',
        aspectCategory: 'Food Quality',
        polarity: SentimentPolarity.Positive,
      },
      {
        id: 'asp-108-2',
        aspectTerm: 'bar service',
        aspectCategory: 'Service',
        polarity: SentimentPolarity.Negative,
      },
    ],
  }),
];

/**
 * Dynamically aggregates aspect counts from SAMPLE_REVIEWS so charts and tables
 * remain strictly consistent with the underlying sample records.
 */
export function buildSampleAspectSummary(reviews: SampleReviewRecord[]): AspectAggregateRow[] {
  const map = new Map<string, AspectAggregateRow>();

  for (const review of reviews) {
    for (const aspect of review.prediction.aspects) {
      const key = `${review.domain}::${aspect.aspectCategory}`;
      const existing = map.get(key) ?? {
        aspectCategory: aspect.aspectCategory,
        domain: review.domain,
        positiveCount: 0,
        neutralCount: 0,
        negativeCount: 0,
        totalMentions: 0,
      };

      if (aspect.polarity === SentimentPolarity.Positive) existing.positiveCount += 1;
      if (aspect.polarity === SentimentPolarity.Neutral) existing.neutralCount += 1;
      if (aspect.polarity === SentimentPolarity.Negative) existing.negativeCount += 1;
      existing.totalMentions += 1;

      map.set(key, existing);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalMentions - a.totalMentions);
}

/**
 * Candidate ML & DL ABSA model registry.
 * IMPORTANT: Evaluation metrics are explicitly `null` (AwaitingTraining) so no
 * fabricated benchmark numbers are displayed.
 */
export const MODEL_REGISTRY_SPECS: ModelArchitectureSpec[] = [
  {
    id: 'tfidf-svm',
    name: 'TF-IDF + Linear SVM',
    family: 'Classical ML',
    datasetTrack: 'SemEval-2014 Task 4 (Laptops & Restaurants)',
    inputRepresentation: 'N-gram TF-IDF vectors + aspect window features',
    purpose: 'Fast interpretable linear baseline for aspect polarity classification.',
    evaluationState: EvaluationState.AwaitingTraining,
    metrics: null,
  },
  {
    id: 'bilstm-attention',
    name: 'BiLSTM + Aspect Attention',
    family: 'Deep Learning',
    datasetTrack: 'SemEval-2014 Task 4 (Laptops & Restaurants)',
    inputRepresentation: 'Pre-trained token embeddings + aspect-target attention pooling',
    purpose: 'Captures sequential context and long-range opinion dependencies around aspect terms.',
    evaluationState: EvaluationState.AwaitingTraining,
    metrics: null,
  },
  {
    id: 'bert-absa',
    name: 'BERT-Base (SPC-ABSA)',
    family: 'Transformer',
    datasetTrack: 'SemEval-2014 Task 4 (Laptops & Restaurants)',
    inputRepresentation: '[CLS] review_text [SEP] aspect_term [SEP] sentence pair encoding',
    purpose: 'Contextualized bidirectional encoder fine-tuned on SemEval-2014 aspect-polarity pairs.',
    evaluationState: EvaluationState.AwaitingTraining,
    metrics: null,
  },
  {
    id: 'deberta-v3-absa',
    name: 'DeBERTa-v3-Base ABSA',
    family: 'Transformer',
    datasetTrack: 'SemEval-2014 Task 4 (Laptops & Restaurants)',
    inputRepresentation: 'Disentangled relative position attention with joint ATE/ASC heads',
    purpose: 'Primary neural architecture target for joint aspect extraction and polarity classification.',
    evaluationState: EvaluationState.AwaitingTraining,
    metrics: null,
  },
];

export const ARCHITECTURE_COMPONENT_DOCS: ArchitectureComponentDoc[] = [
  {
    id: 'comp-ingestion',
    title: '01. Input & CSV Validation Pipeline',
    layer: 'Data Ingestion Layer',
    modulePath: 'src/services/csvParser.ts',
    implementationStatus: 'Implemented (Sample Preview)',
    purpose:
      'Validates individual text submissions and batch CSV files for required headers (review_text), character boundaries, encoding safety, and malformed quote structures before passing data downstream.',
    inputs: 'Single review string or UTF-8 .csv file (max 5 MB)',
    outputs: 'Structured ParsedCsvRow[] with row-level validation diagnostics',
  },
  {
    id: 'comp-model-adapter',
    title: '02. ABSA Model Inference Adapter',
    layer: 'Prediction Layer (Isolated)',
    modulePath: 'src/services/modelAdapter.ts',
    implementationStatus: 'Interface Ready (Phase 2)',
    purpose:
      'Defines a strict contract for Aspect Term Extraction (ATE) and Aspect Sentiment Classification (ASC) models. Keeps predictive outputs isolated from generative LLM text so model benchmarks remain auditable.',
    inputs: 'Validated review text + domain + target model ID',
    outputs: 'ModelPredictionPayload (aspect spans, polarity labels, latency)',
  },
  {
    id: 'comp-benchmarks',
    title: '03. SemEval-2014 Training & Evaluation Registry',
    layer: 'Experimentation & Metrics',
    modulePath: 'src/components/models/ModelBenchmarksView.tsx',
    implementationStatus: 'Interface Ready (Phase 2)',
    purpose:
      'Tracks classical ML (SVM) and deep learning / transformer architectures (BiLSTM, BERT, DeBERTa-v3) trained on SemEval-2014 Task 4, recording Accuracy, Precision, Recall, and Macro-F1 without fabricated defaults.',
    inputs: 'SemEval-2014 XML/CSV training & test splits',
    outputs: 'Verified ModelArchitectureSpec evaluation rows & confusion metrics',
  },
  {
    id: 'comp-gemini-explanation',
    title: '04. Gemini Explanation Service',
    layer: 'Interpretability Layer (Decoupled)',
    modulePath: 'src/services/explanationService.ts',
    implementationStatus: 'Interface Ready (Phase 2)',
    purpose:
      'Provides optional post-hoc natural language rationales explaining why a review reflects positive, negative, or neutral sentiment toward specific aspects, strictly separated from classifier predictions.',
    inputs: 'Review text + ModelPredictionPayload aspect spans',
    outputs: 'GeminiExplanationPayload (human-readable rationale per aspect)',
  },
  {
    id: 'comp-reporting',
    title: '05. Visualization & Academic Report Exporter',
    layer: 'Presentation & Export',
    modulePath: 'src/services/reportExport.ts',
    implementationStatus: 'Implemented (Sample Preview)',
    purpose:
      'Aggregates aspect-wise polarity distributions, renders span highlights, and exports structured JSON/CSV inspection reports clearly stamped with data provenance (Sample Preview vs. Trained Model).',
    inputs: 'SampleReviewRecord[] or evaluated batch predictions',
    outputs: 'AspectAggregateRow charts and downloadable JSON/CSV academic reports',
  },
];
