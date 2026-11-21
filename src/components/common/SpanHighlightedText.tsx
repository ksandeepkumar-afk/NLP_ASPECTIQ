import { AnalyzedAspectOutput } from '../../types/absa';

interface SpanHighlightedTextProps {
  text: string;
  aspects: AnalyzedAspectOutput[];
}

export function SpanHighlightedText({ text, aspects }: SpanHighlightedTextProps) {
  const validSpans = aspects
    .filter(
      (a) =>
        !a.isImplicit &&
        a.aspectTerm !== null &&
        a.endOffset > a.startOffset &&
        a.startOffset >= 0 &&
        a.endOffset <= text.length
    )
    .sort((a, b) => a.startOffset - b.startOffset);

  if (validSpans.length === 0) {
    return <span>{text}</span>;
  }

  const segments: Array<{ key: string; content: string; aspect?: AnalyzedAspectOutput }> = [];
  let cursor = 0;

  for (const asp of validSpans) {
    if (asp.startOffset < cursor) continue;
    if (asp.startOffset > cursor) {
      segments.push({
        key: `txt-${cursor}`,
        content: text.slice(cursor, asp.startOffset),
      });
    }
    segments.push({
      key: asp.id,
      content: text.slice(asp.startOffset, asp.endOffset),
      aspect: asp,
    });
    cursor = asp.endOffset;
  }

  if (cursor < text.length) {
    segments.push({
      key: `txt-${cursor}`,
      content: text.slice(cursor),
    });
  }

  return (
    <>
      {segments.map((seg) => {
        if (!seg.aspect) {
          return <span key={seg.key}>{seg.content}</span>;
        }
        const highlightClass =
          seg.aspect.sentiment === 'Positive'
            ? 'bg-emerald-500/15 text-emerald-200 border-b-2 border-emerald-400'
            : seg.aspect.sentiment === 'Negative'
            ? 'bg-rose-500/15 text-rose-200 border-b-2 border-rose-400'
            : 'bg-slate-700/60 text-slate-100 border-b-2 border-slate-400';

        return (
          <mark key={seg.key} className={`${highlightClass} px-1 rounded-xs font-medium`}>
            {seg.content}
          </mark>
        );
      })}
    </>
  );
}
