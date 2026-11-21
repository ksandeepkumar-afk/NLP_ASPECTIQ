import { EvaluationState, ModelArchitectureSpec } from '../types/absa';

/**
 * Optional unannotated example inputs for the Statement Analyzer.
 * Zero pre-computed results are stored here; clicking an example populates
 * the input box so live inference runs on the backend.
 */
export const OPTIONAL_STATEMENT_EXAMPLES: Array<{ label: string; text: string }> = [
  {
    label: 'Mixed Contrast',
    text: 'The laptop is lightweight, but its battery lasts only two hours.',
  },
  {
    label: 'Sarcasm & Frustration',
    text: 'Wow, another brilliant decision! Now everything is broken.',
  },
  {
    label: 'Litotes / Negation',
    text: 'That was not bad at all; I actually enjoyed it.',
  },
  {
    label: 'Implicit Appearance',
    text: 'She was beautiful.',
  },
  {
    label: 'Polite Disagreement',
    text: 'I appreciate your help, but I disagree with your conclusion.',
  },
  {
    label: 'Factual Neutral',
    text: 'The meeting starts at 10 AM in the conference room.',
  },
];

/**
 * Optional example conversation for the Conversation Analyzer.
 */
export const OPTIONAL_CONVERSATION_EXAMPLE = [
  'Customer: My phone dies in two hours after the update.',
  'Support: Thanks for reaching out! Have you checked background app usage?',
  'Customer: Yes, I disabled everything, and battery backup is still disappointing.',
  'Support: I understand how frustrating that is. Let me arrange a diagnostic replacement right away.',
  'Customer: Thank you, I really appreciate the quick resolution.',
].join('\n');

/**
 * Optional batch test set tailored for semantic search & topic clustering exploration.
 */
export const OPTIONAL_BATCH_EXAMPLES: string[] = [
  'My phone dies in two hours after a full charge.',
  'Battery backup is disappointing during travel.',
  'I have to charge it constantly before noon.',
  'The camera captures sharp night portraits with natural skin tones.',
  'Photo colors look crisp even in dim indoor lighting.',
  'Customer support resolved my billing issue politely in five minutes.',
  'Waiting forty minutes for support chat without a reply was frustrating.',
  'Wow, another broken update that slows down the whole app.',
];

/**
 * Small labeled SemEval-style sentiment corpus (30 real labeled sentences) used ONLY when
 * the user explicitly runs the local TF-IDF + Logistic Regression train/test benchmark
 * (80/20 stratified split) or uploads their own labeled CSV.
 */
export const SEMEVAL_STYLE_LABELED_CORPUS: Array<{ text: string; label: string }> = [
  { text: 'The camera quality is excellent and takes crisp photos outdoors.', label: 'Positive' },
  { text: 'Food was fresh with vibrant spices and attentive table service.', label: 'Positive' },
  { text: 'Lightweight chassis makes this laptop effortless to carry daily.', label: 'Positive' },
  { text: 'The display brightness and color accuracy are impressive for editing.', label: 'Positive' },
  { text: 'Quick delivery and courteous packaging made a great first impression.', label: 'Positive' },
  { text: 'Clear explanation and super helpful documentation throughout.', label: 'Positive' },
  { text: 'Comfortable seating and quiet ambience suited our meeting well.', label: 'Positive' },
  { text: 'Fast charging reaches eighty percent in twenty five minutes.', label: 'Positive' },
  { text: 'Amazing effort from the team to resolve the outage promptly.', label: 'Positive' },
  { text: 'Loved the crispy crust and generous fresh toppings on every slice.', label: 'Positive' },
  { text: 'The battery drains very quickly and barely survives half a day.', label: 'Negative' },
  { text: 'Slow kitchen service meant waiting forty five minutes for lukewarm food.', label: 'Negative' },
  { text: 'Application crashes repeatedly whenever exporting large spreadsheets.', label: 'Negative' },
  { text: 'Keyboard keys feel mushy and double register during fast typing.', label: 'Negative' },
  { text: 'Overpriced menu items with tiny portions and rude staff.', label: 'Negative' },
  { text: 'Speaker clarity distorts noticeably at medium volume.', label: 'Negative' },
  { text: 'Another brilliant update that broke Wi-Fi connectivity completely.', label: 'Negative' },
  { text: 'Poor customer support took four days just to acknowledge the ticket.', label: 'Negative' },
  { text: 'Screen glare makes the monitor unusable near a sunny window.', label: 'Negative' },
  { text: 'Heavy plastic build feels cheap and creaks when opened.', label: 'Negative' },
  { text: 'The meeting starts at 10 AM in conference room B.', label: 'Neutral' },
  { text: 'Package arrived on Tuesday afternoon in standard brown cardboard.', label: 'Neutral' },
  { text: 'Available in silver and graphite with 256 GB storage.', label: 'Neutral' },
  { text: 'The menu includes vegetarian and gluten free options.', label: 'Neutral' },
  { text: 'Software version 2.4 was released for desktop platforms.', label: 'Neutral' },
  { text: 'Please forward the updated schedule before Friday morning.', label: 'Neutral' },
  { text: 'Store hours run from nine until six on weekdays.', label: 'Neutral' },
  { text: 'The laptop weighs 1.3 kilograms and uses a USB-C charger.', label: 'Neutral' },
  { text: 'Reservations are accepted online or by phone.', label: 'Neutral' },
  { text: 'This model ships with a standard one year warranty.', label: 'Neutral' },
];

export const MODEL_REGISTRY_SPECS: ModelArchitectureSpec[] = [
  {
    id: 'tfidf-logreg',
    name: 'TF-IDF + Logistic Regression',
    family: 'Classical ML',
    datasetTrack: 'Sentiment / Comment / Aspect-Polarity Classification',
    inputRepresentation: 'Unigram + Bigram L2-normalized TF-IDF vectors with softmax multinomial regression',
    purpose:
      'Interpretable linear baseline runnable directly on this server. Trains on an 80/20 stratified split and emits genuine Confusion Matrix, Accuracy, Macro-P/R/F1, and epoch loss curves.',
    inferenceStatus: 'Active Local Trainable',
    evaluationState: EvaluationState.AwaitingTraining,
  },
  {
    id: 'lstm',
    name: 'Bidirectional LSTM',
    family: 'Deep Learning',
    datasetTrack: 'SemEval-2014 ABSA / Emotion / Sarcasm Classification',
    inputRepresentation: 'Pretrained token embeddings + Bi-LSTM sequence encoder',
    purpose:
      'Sequential recurrent model capturing word order and negation scope. Requires Python PyTorch training runtime; no fabricated benchmark numbers are shown.',
    inferenceStatus: 'Requires Python PyTorch Runtime',
    evaluationState: EvaluationState.AwaitingTraining,
  },
  {
    id: 'attention-lstm',
    name: 'Attention-Based LSTM (ATAE-LSTM)',
    family: 'Deep Learning',
    datasetTrack: 'SemEval-2014 Task 4 Aspect-Level Polarity',
    inputRepresentation: 'Aspect-conditioned attention weights over Bi-LSTM hidden states',
    purpose:
      'Weights opinion tokens relative to target aspect embeddings to separate multi-aspect contrasts. Requires Python PyTorch training runtime.',
    inferenceStatus: 'Requires Python PyTorch Runtime',
    evaluationState: EvaluationState.AwaitingTraining,
  },
  {
    id: 'bert',
    name: 'BERT-Base / DeBERTa-v3',
    family: 'Transformer',
    datasetTrack: 'SemEval-2014 ABSA + Sarcasm + Emotion Benchmarks',
    inputRepresentation: 'Contextual self-attention encoder with span/classification heads',
    purpose:
      'Fine-tuned transformer architecture for high-accuracy multi-task ABSA, sarcasm, and emotion classification. Requires Python Transformers GPU runtime.',
    inferenceStatus: 'Requires Python PyTorch Runtime',
    evaluationState: EvaluationState.AwaitingTraining,
  },
  {
    id: 'gemini-api-internal',
    name: 'Internal API Inference (gemini-3.1-flash-lite + gemini-embedding-2)',
    family: 'API LLM',
    datasetTrack: 'Live Zero-Shot Domain-Independent NLP & Embeddings',
    inputRepresentation: 'Schema-constrained LLM generation & dense semantic embeddings',
    purpose:
      'Powers live statement, conversation, batch, and semantic search inference. Clearly separated from trained benchmark models and does not emit calibrated probabilities.',
    inferenceStatus: 'Active Internal API Provider',
    evaluationState: EvaluationState.AwaitingTraining,
  },
];
