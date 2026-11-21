/**
 * Aspect Term & Category Extraction Engine
 * Combines domain-grounded multi-word phrase matching with syntactic
 * subject-noun-phrase extraction before copula/opinion verbs, preserving
 * exact character offsets and binding each aspect to its local discourse clause.
 */

import type { DiscourseClause } from './tokenizer.ts';

export type SupportedDomain = 'Electronics' | 'Restaurants';

export interface ExtractedAspectSpan {
  id: string;
  aspectTerm: string;
  aspectCategory: string;
  startOffset: number;
  endOffset: number;
  clauseText: string;
  clauseTokens: string[];
}

interface AspectLexiconRule {
  category: string;
  domains: SupportedDomain[];
  terms: string[];
}

const ASPECT_LEXICON: AspectLexiconRule[] = [
  // Electronics aspects
  {
    category: 'Camera',
    domains: ['Electronics'],
    terms: [
      'telephoto camera lens',
      'camera night mode',
      'low-light portraits',
      'camera autofocus',
      'camera quality',
      'camera sensor',
      'front camera',
      'selfie camera',
      'rear camera',
      'main camera',
      'camera lens',
      'photo quality',
      'video quality',
      'night mode',
      'autofocus',
      'camera',
      'cameras',
      'photos',
      'zoom',
    ],
  },
  {
    category: 'Battery',
    domains: ['Electronics'],
    terms: [
      'battery endurance',
      'battery charging',
      'battery backup',
      'battery life',
      'fast charging',
      'charging speed',
      'wireless charging',
      'screen-on time',
      'battery',
      'charging',
      'charger',
    ],
  },
  {
    category: 'Display',
    domains: ['Electronics'],
    terms: [
      'display brightness',
      '120hz display',
      'amoled display',
      'oled display',
      'matte display',
      'retina display',
      'refresh rate',
      'viewing angles',
      'color accuracy',
      'touchscreen',
      'display',
      'screen',
      'brightness',
    ],
  },
  {
    category: 'Performance',
    domains: ['Electronics'],
    terms: [
      'thermal performance',
      'app switching',
      'multitasking',
      'processing speed',
      'performance',
      'processor',
      'chipset',
      'graphics',
      'memory',
      'ram',
      'speed',
      'lag',
    ],
  },
  {
    category: 'Build Quality',
    domains: ['Electronics'],
    terms: [
      'aluminum chassis',
      'build quality',
      'craftsmanship',
      'form factor',
      'durability',
      'keyboard',
      'trackpad',
      'chassis',
      'hinge',
      'design',
      'weight',
      'body',
    ],
  },
  {
    category: 'Audio',
    domains: ['Electronics'],
    terms: [
      'speaker clarity',
      'speaker volume',
      'sound quality',
      'stereo speakers',
      'microphone',
      'speakers',
      'speaker',
      'audio',
      'sound',
    ],
  },
  // Restaurants aspects
  {
    category: 'Food Quality',
    domains: ['Restaurants'],
    terms: [
      'broth and handmade noodles',
      'food quality',
      'signature curry',
      'portion sizes',
      'portion size',
      'dessert portions',
      'appetizers',
      'appetizer',
      'ingredients',
      'freshness',
      'seasonal sides',
      'main course',
      'noodles',
      'desserts',
      'dessert',
      'pastries',
      'flavors',
      'flavor',
      'dishes',
      'coffee',
      'drinks',
      'salmon',
      'pasta',
      'pizza',
      'curry',
      'steak',
      'salad',
      'broth',
      'food',
      'meal',
      'dish',
      'taste',
      'menu',
    ],
  },
  {
    category: 'Service',
    domains: ['Restaurants'],
    terms: [
      'kitchen service',
      'table service',
      'service staff',
      'bar service',
      'customer service',
      'wait time',
      'waiter',
      'waitress',
      'servers',
      'server',
      'service',
      'staff',
      'host',
      'hospitality',
      'delivery',
    ],
  },
  {
    category: 'Ambience',
    domains: ['Restaurants'],
    terms: [
      'dining ambience',
      'noise level',
      'ambience',
      'ambiance',
      'atmosphere',
      'interior',
      'seating',
      'lighting',
      'cleanliness',
      'decor',
      'patio',
      'vibe',
    ],
  },
  // Cross-domain Pricing & Support
  {
    category: 'Pricing',
    domains: ['Electronics', 'Restaurants'],
    terms: [
      'value for money',
      'menu pricing',
      'retail price',
      'price tag',
      'pricing',
      'prices',
      'price',
      'value',
      'cost',
      'bill',
    ],
  },
  {
    category: 'Customer Support',
    domains: ['Electronics', 'Restaurants'],
    terms: ['customer support', 'shipping speed', 'shipping', 'packaging', 'warranty', 'support'],
  },
];

const SYNTACTIC_STOPWORDS = new Set([
  'it',
  'this',
  'that',
  'these',
  'those',
  'they',
  'them',
  'there',
  'here',
  'everything',
  'nothing',
  'something',
  'anything',
  'one',
  'way',
  'thing',
  'things',
  'place',
  'product',
  'item',
  'device',
  'phone',
  'laptop',
  'restaurant',
  'experience',
  'overall',
  'quality',
]);

interface CandidateMatch {
  term: string;
  category: string;
  startOffset: number;
  endOffset: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toTitleCase(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extracts non-overlapping aspect terms using both domain-grounded longest-span
 * phrase matching and syntactic subject-noun-phrase detection before opinion verbs.
 */
export function extractAspectSpans(
  reviewText: string,
  domain: SupportedDomain,
  clauses: DiscourseClause[]
): ExtractedAspectSpan[] {
  const activeRules = ASPECT_LEXICON.filter((rule) => rule.domains.includes(domain));

  const termEntries: Array<{ term: string; category: string }> = [];
  for (const rule of activeRules) {
    for (const term of rule.terms) {
      termEntries.push({ term, category: rule.category });
    }
  }
  termEntries.sort((a, b) => b.term.length - a.term.length);

  const accepted: CandidateMatch[] = [];

  for (const entry of termEntries) {
    const pattern = new RegExp(`\\b${escapeRegex(entry.term)}\\b`, 'gi');
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(reviewText)) !== null) {
      const startOffset = match.index;
      const endOffset = startOffset + match[0].length;

      const overlapsExisting = accepted.some(
        (existing) => !(endOffset <= existing.startOffset || startOffset >= existing.endOffset)
      );

      if (!overlapsExisting) {
        accepted.push({
          term: match[0],
          category: entry.category,
          startOffset,
          endOffset,
        });
      }
    }
  }

  // Syntactic noun-phrase fallback: "<det> <noun phrase> <copula/opinion verb>"
  const syntacticPattern =
    /\b(?:the|their|its|our|this)\s+([a-z][a-z0-9-]*(?:\s+[a-z][a-z0-9-]*){0,1})\s+(?:is|was|are|were|feels|felt|looks|looked|sounds|sounded|tastes|tasted|seems|seemed|remains|drains|lasts|arrived|worked)\b/gi;
  let synMatch: RegExpExecArray | null;

  while ((synMatch = syntacticPattern.exec(reviewText)) !== null) {
    const candidatePhrase = synMatch[1].trim();
    const lowerCandidate = candidatePhrase.toLowerCase();
    if (candidatePhrase.length < 3 || SYNTACTIC_STOPWORDS.has(lowerCandidate)) {
      continue;
    }

    const phraseIndexInFull = synMatch[0].toLowerCase().indexOf(lowerCandidate);
    if (phraseIndexInFull === -1) continue;

    const startOffset = synMatch.index + phraseIndexInFull;
    const endOffset = startOffset + candidatePhrase.length;

    const overlapsExisting = accepted.some(
      (existing) => !(endOffset <= existing.startOffset || startOffset >= existing.endOffset)
    );

    if (!overlapsExisting) {
      accepted.push({
        term: reviewText.slice(startOffset, endOffset),
        category: toTitleCase(candidatePhrase),
        startOffset,
        endOffset,
      });
    }
  }

  accepted.sort((a, b) => a.startOffset - b.startOffset);

  return accepted.map((item, idx) => {
    const containingClause =
      clauses.find(
        (c) => item.startOffset >= c.startOffset && item.endOffset <= c.endOffset
      ) ??
      clauses.find(
        (c) => item.startOffset < c.endOffset && item.endOffset > c.startOffset
      ) ?? {
        text: reviewText,
        startOffset: 0,
        endOffset: reviewText.length,
        tokens: [],
      };

    return {
      id: `live-asp-${idx + 1}`,
      aspectTerm: item.term,
      aspectCategory: item.category,
      startOffset: item.startOffset,
      endOffset: item.endOffset,
      clauseText: containingClause.text,
      clauseTokens: containingClause.tokens,
    };
  });
}
