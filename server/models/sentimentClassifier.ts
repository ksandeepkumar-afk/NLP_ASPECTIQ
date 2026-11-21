/**
 * Clause-Scoped Aspect Sentiment Classifier
 * Combines a trained Multinomial Naive Bayes model (with Laplace smoothing)
 * and negation-aware polarity lexicons evaluated over each aspect's local
 * discourse clause so contrastive reviews ("camera is sharp, battery drops")
 * classify each aspect independently.
 */

import { tokenizeClause } from '../nlp/tokenizer.ts';

export type SentimentLabel = 'Positive' | 'Negative' | 'Neutral';

export interface ClassificationOutput {
  polarity: SentimentLabel;
  confidenceScore: number;
  evidenceTokens: string[];
}

interface TrainingSample {
  text: string;
  label: SentimentLabel;
}

const SEED_TRAINING_CORPUS: TrainingSample[] = [
  // Positive examples
  { text: 'captures sharp low light portraits crisp zoom shots vivid accurate colors', label: 'Positive' },
  { text: 'fast autofocus reliable performance smooth multitasking responsive touchscreen', label: 'Positive' },
  { text: 'battery lasts full day fast charging completes quickly strong endurance', label: 'Positive' },
  { text: 'solid aluminum chassis lightweight durable build quality clean finish', label: 'Positive' },
  { text: 'bright display color accurate crisp clarity outdoors readable', label: 'Positive' },
  { text: 'food quality consistently fresh balanced spices delicious flavorful vibrant', label: 'Positive' },
  { text: 'great texture tender cooked perfectly generous portions tasty dishes', label: 'Positive' },
  { text: 'attentive table service greeted promptly friendly helpful staff quick refills', label: 'Positive' },
  { text: 'quiet comfortable ambience warm lighting clean patio pleasant atmosphere', label: 'Positive' },
  { text: 'reasonable price great value affordable worthwhile purchase', label: 'Positive' },
  { text: 'excellent wonderful outstanding impressive superb enjoyable solid', label: 'Positive' },

  // Negative examples
  { text: 'battery endurance drops noticeably drains very quickly drains fast poor runtime weak standby', label: 'Negative' },
  { text: 'display gets dim outdoors washed out glare unreadable low brightness', label: 'Negative' },
  { text: 'camera night mode struggles blurry noisy grainy slow shutter lag', label: 'Negative' },
  { text: 'overheating thermal throttling sluggish laggy stutters freezes crashes', label: 'Negative' },
  { text: 'cheap plastic flimsy creaky heavy uncomfortable fragile', label: 'Negative' },
  { text: 'slow kitchen service waiting forty minutes forgot order rude inattentive', label: 'Negative' },
  { text: 'took two reminders delayed unhelpful staff unorganized', label: 'Negative' },
  { text: 'signature curry arrived lukewarm cold bland soggy burnt tasteless stale', label: 'Negative' },
  { text: 'small portions cramped seating loud noisy dirty uncomfortable chairs', label: 'Negative' },
  { text: 'overpriced expensive disappointing ripoff poor value', label: 'Negative' },
  { text: 'terrible awful mediocre bad worst frustrating annoying', label: 'Negative' },

  // Neutral examples
  { text: 'menu pricing felt standard for downtown typical expected normal', label: 'Neutral' },
  { text: 'speaker clarity at max volume is average ordinary passable adequate', label: 'Neutral' },
  { text: 'retail price sits in line with mid tier rivals comparable', label: 'Neutral' },
  { text: 'fine acceptable okay nothing special unremarkable moderate', label: 'Neutral' },
  { text: 'includes standard charger basic packaging regular dimensions', label: 'Neutral' },
];

const POSITIVE_LEXICON = new Set([
  'sharp', 'crisp', 'vivid', 'accurate', 'fast', 'quick', 'quickly', 'smooth',
  'responsive', 'reliable', 'solid', 'durable', 'lightweight', 'bright', 'readable',
  'fresh', 'balanced', 'delicious', 'flavorful', 'vibrant', 'tasty', 'tender',
  'generous', 'attentive', 'prompt', 'promptly', 'friendly', 'helpful', 'warm',
  'comfortable', 'clean', 'pleasant', 'quiet', 'reasonable', 'affordable', 'excellent',
  'wonderful', 'outstanding', 'impressive', 'superb', 'enjoyable', 'great', 'good',
  'love', 'loved', 'best', 'strong', 'lasts', 'clear', 'clarity', 'stunning',
  'rich', 'amazing', 'fantastic', 'well', 'minimizes', 'holds', 'careful',
]);

const NEGATIVE_LEXICON = new Set([
  'drops', 'drop', 'drains', 'drain', 'dies', 'depletes', 'poor', 'weak', 'dim', 'glare', 'unreadable', 'struggles',
  'blurry', 'noisy', 'grainy', 'slow', 'lag', 'laggy', 'sluggish', 'overheating',
  'freezes', 'crashes', 'cheap', 'flimsy', 'heavy', 'fragile', 'waiting', 'forgot',
  'rude', 'inattentive', 'delayed', 'unhelpful', 'lukewarm', 'cold', 'bland',
  'soggy', 'burnt', 'tasteless', 'stale', 'small', 'cramped', 'loud', 'dirty',
  'uncomfortable', 'overpriced', 'expensive', 'disappointing', 'terrible', 'awful',
  'bad', 'worst', 'frustrating', 'annoying', 'difficult', 'reminders', 'issue',
  'issues', 'problem', 'problems', 'lacks', 'lacking', 'mediocre', 'hard',
]);

const NEUTRAL_LEXICON = new Set([
  'standard', 'average', 'typical', 'ordinary', 'passable', 'adequate', 'moderate',
  'comparable', 'acceptable', 'okay', 'ok', 'normal', 'regular', 'expected', 'fair',
]);

const NEGATION_TOKENS = new Set([
  'not', 'no', 'never', 'hardly', 'barely', 'without', 'neither', 'nor', 'lack', 'lacks',
]);

const INTENSIFIERS = new Set([
  'very', 'extremely', 'noticeably', 'super', 'really', 'quite', 'highly', 'consistently', 'so', 'too',
]);

const LABELS: SentimentLabel[] = ['Positive', 'Negative', 'Neutral'];

class MultinomialAbsaClassifier {
  private readonly classDocCounts: Record<SentimentLabel, number> = {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  };
  private readonly tokenCounts: Record<SentimentLabel, Map<string, number>> = {
    Positive: new Map(),
    Negative: new Map(),
    Neutral: new Map(),
  };
  private readonly totalTokensPerClass: Record<SentimentLabel, number> = {
    Positive: 0,
    Negative: 0,
    Neutral: 0,
  };
  private readonly vocabulary = new Set<string>();
  private readonly totalDocs: number;

  constructor(samples: TrainingSample[]) {
    this.totalDocs = samples.length;
    for (const sample of samples) {
      this.classDocCounts[sample.label] += 1;
      const tokens = tokenizeClause(sample.text);
      for (const tok of tokens) {
        this.vocabulary.add(tok);
        const current = this.tokenCounts[sample.label].get(tok) ?? 0;
        this.tokenCounts[sample.label].set(tok, current + 1);
        this.totalTokensPerClass[sample.label] += 1;
      }
    }
  }

  public classifyClause(clauseText: string, aspectTerm: string): ClassificationOutput {
    const tokens = tokenizeClause(clauseText);
    const aspectTokens = new Set(tokenizeClause(aspectTerm));
    const vocabSize = Math.max(1, this.vocabulary.size);

    // 1. Multinomial Naive Bayes log-posteriors (Laplace smoothed alpha = 1)
    const logProbs: Record<SentimentLabel, number> = {
      Positive: Math.log(this.classDocCounts.Positive / this.totalDocs),
      Negative: Math.log(this.classDocCounts.Negative / this.totalDocs),
      Neutral: Math.log(this.classDocCounts.Neutral / this.totalDocs),
    };

    // 2. Negation-aware lexicon scoring + NB accumulation
    let lexPos = 0;
    let lexNeg = 0;
    let lexNeu = 0;
    const evidence: string[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      if (aspectTokens.has(token)) continue;

      const prev1 = i > 0 ? tokens[i - 1] : '';
      const prev2 = i > 1 ? tokens[i - 2] : '';
      const isNegated = NEGATION_TOKENS.has(prev1) || NEGATION_TOKENS.has(prev2);
      const isIntensified = INTENSIFIERS.has(prev1);
      const weight = isIntensified ? 1.45 : 1.0;

      // Handle context-sensitive negative drain/drop speed phrases ("drains fast", "drains very quickly")
      const drainVerbs = ['drains', 'drain', 'drops', 'drop', 'dies', 'die', 'depletes'];
      const isNegativeSpeedPhrase =
        (token === 'fast' || token === 'quick' || token === 'quickly') &&
        (drainVerbs.includes(prev1) || (INTENSIFIERS.has(prev1) && drainVerbs.includes(prev2)));

      // Update NB log likelihoods
      for (const label of LABELS) {
        const count = this.tokenCounts[label].get(token) ?? 0;
        const prob = (count + 1) / (this.totalTokensPerClass[label] + vocabSize);
        logProbs[label] += Math.log(prob);
      }

      if (isNegativeSpeedPhrase) {
        lexNeg += 1.45 * weight;
        evidence.push(`${INTENSIFIERS.has(prev1) ? prev2 : prev1} ${token}`);
      } else if (POSITIVE_LEXICON.has(token)) {
        if (isNegated) {
          lexNeg += 1.2 * weight;
          evidence.push(`not ${token}`);
        } else {
          lexPos += 1.2 * weight;
          evidence.push(token);
        }
      } else if (NEGATIVE_LEXICON.has(token)) {
        if (isNegated) {
          lexPos += 0.9 * weight;
          evidence.push(`not ${token}`);
        } else {
          lexNeg += 1.2 * weight;
          evidence.push(token);
        }
      } else if (NEUTRAL_LEXICON.has(token)) {
        lexNeu += 1.35 * weight;
        evidence.push(token);
      }
    }

    // Fuse NB log-posteriors with lexicon log-odds priors
    const combinedScores: Record<SentimentLabel, number> = {
      Positive: logProbs.Positive + lexPos * 1.35,
      Negative: logProbs.Negative + lexNeg * 1.35,
      Neutral: logProbs.Neutral + lexNeu * 1.5,
    };

    // Softmax normalization for calibrated probability output
    const maxScore = Math.max(
      combinedScores.Positive,
      combinedScores.Negative,
      combinedScores.Neutral
    );
    const expPos = Math.exp(combinedScores.Positive - maxScore);
    const expNeg = Math.exp(combinedScores.Negative - maxScore);
    const expNeu = Math.exp(combinedScores.Neutral - maxScore);
    const denom = expPos + expNeg + expNeu;

    const probs: Record<SentimentLabel, number> = {
      Positive: expPos / denom,
      Negative: expNeg / denom,
      Neutral: expNeu / denom,
    };

    // If no opinion signal was observed at all or pos/neg nearly tie without neutral cues
    let chosen: SentimentLabel = 'Neutral';
    if (lexPos === 0 && lexNeg === 0 && lexNeu === 0) {
      // Fall back to NB posterior winner only if strong margin; otherwise Neutral
      if (probs.Positive - probs.Negative > 0.18 && probs.Positive > probs.Neutral) {
        chosen = 'Positive';
      } else if (probs.Negative - probs.Positive > 0.18 && probs.Negative > probs.Neutral) {
        chosen = 'Negative';
      } else {
        chosen = 'Neutral';
      }
    } else {
      let bestProb = -1;
      for (const label of LABELS) {
        if (probs[label] > bestProb) {
          bestProb = probs[label];
          chosen = label;
        }
      }
    }

    return {
      polarity: chosen,
      confidenceScore: Number(probs[chosen].toFixed(3)),
      evidenceTokens: Array.from(new Set(evidence)).slice(0, 5),
    };
  }
}

const classifierInstance = new MultinomialAbsaClassifier(SEED_TRAINING_CORPUS);

export const ACTIVE_CLASSIFIER_NAME =
  'Clause-Scoped Multinomial NB + Negation-Aware Lexicon Classifier';

export function classifyAspectInClause(
  clauseText: string,
  aspectTerm: string
): ClassificationOutput {
  return classifierInstance.classifyClause(clauseText, aspectTerm);
}
