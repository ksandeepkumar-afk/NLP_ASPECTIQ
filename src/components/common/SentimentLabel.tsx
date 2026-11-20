import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { SentimentPolarity } from '../../types/absa';

interface SentimentLabelProps {
  polarity: SentimentPolarity;
}

/**
 * Displays sentiment polarity using accessible icon + explicit text label
 * without static pill capsules.
 */
export function SentimentLabel({ polarity }: SentimentLabelProps) {
  if (polarity === SentimentPolarity.Positive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 whitespace-nowrap">
        <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Positive</span>
      </span>
    );
  }

  if (polarity === SentimentPolarity.Negative) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 whitespace-nowrap">
        <ArrowDownRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Negative</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 whitespace-nowrap">
      <Minus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Neutral</span>
    </span>
  );
}
