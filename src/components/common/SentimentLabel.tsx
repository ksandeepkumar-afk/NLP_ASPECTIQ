import { ArrowDownRight, ArrowUpRight, GitCompareArrows, Minus } from 'lucide-react';
import { OverallSentiment } from '../../types/absa';

interface SentimentLabelProps {
  polarity: OverallSentiment;
}

/**
 * Displays sentiment polarity using accessible icon + explicit text label
 * without static pill capsules.
 */
export function SentimentLabel({ polarity }: SentimentLabelProps) {
  if (polarity === 'Positive') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 whitespace-nowrap">
        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Positive</span>
      </span>
    );
  }

  if (polarity === 'Negative') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400 whitespace-nowrap">
        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Negative</span>
      </span>
    );
  }

  if (polarity === 'Mixed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 whitespace-nowrap">
        <GitCompareArrows className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Mixed</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 whitespace-nowrap">
      <Minus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Neutral</span>
    </span>
  );
}
