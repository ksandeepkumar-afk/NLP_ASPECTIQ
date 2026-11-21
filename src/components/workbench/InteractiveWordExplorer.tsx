import { useState } from 'react';
import { ExplorerSpan, SpanHighlightCategory } from '../../types/absa';

interface InteractiveWordExplorerProps {
  text: string;
  spans: ExplorerSpan[];
}

const CATEGORY_STYLES: Record<
  SpanHighlightCategory,
  { label: string; buttonClass: string; swatchClass: string }
> = {
  positive_expression: {
    label: 'Positive Opinion',
    buttonClass:
      'bg-emerald-500/15 text-emerald-200 border-b-2 border-emerald-400 hover:bg-emerald-500/25',
    swatchClass: 'bg-emerald-400',
  },
  negative_expression: {
    label: 'Negative Opinion',
    buttonClass:
      'bg-rose-500/15 text-rose-200 border-b-2 border-rose-400 hover:bg-rose-500/25',
    swatchClass: 'bg-rose-400',
  },
  sarcastic_expression: {
    label: 'Sarcasm / Irony',
    buttonClass:
      'bg-amber-500/15 text-amber-200 border-b-2 border-amber-400 hover:bg-amber-500/25',
    swatchClass: 'bg-amber-400',
  },
  aspect: {
    label: 'Extracted Aspect',
    buttonClass:
      'bg-blue-500/15 text-blue-200 border-b-2 border-blue-400 hover:bg-blue-500/25',
    swatchClass: 'bg-blue-400',
  },
  negation: {
    label: 'Negation Word',
    buttonClass:
      'bg-violet-500/20 text-violet-200 border-b-2 border-violet-400 hover:bg-violet-500/30',
    swatchClass: 'bg-violet-400',
  },
  emotional_expression: {
    label: 'Emotional Expression',
    buttonClass:
      'bg-cyan-500/15 text-cyan-200 border-b-2 border-cyan-400 hover:bg-cyan-500/25',
    swatchClass: 'bg-cyan-400',
  },
};

export function InteractiveWordExplorer({ text, spans }: InteractiveWordExplorerProps) {
  const validSpans = spans
    .filter((s) => s.endOffset > s.startOffset && s.startOffset >= 0 && s.endOffset <= text.length)
    .sort((a, b) => a.startOffset - b.startOffset);

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(
    validSpans[0]?.id ?? null
  );

  const selectedSpan = validSpans.find((s) => s.id === selectedSpanId) ?? validSpans[0] ?? null;

  const segments: Array<{ key: string; content: string; span?: ExplorerSpan }> = [];
  let cursor = 0;

  for (const sp of validSpans) {
    if (sp.startOffset < cursor) continue;
    if (sp.startOffset > cursor) {
      segments.push({
        key: `plain-${cursor}`,
        content: text.slice(cursor, sp.startOffset),
      });
    }
    segments.push({
      key: sp.id,
      content: text.slice(sp.startOffset, sp.endOffset),
      span: sp,
    });
    cursor = sp.endOffset;
  }

  if (cursor < text.length) {
    segments.push({
      key: `plain-${cursor}`,
      content: text.slice(cursor),
    });
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
        {(Object.keys(CATEGORY_STYLES) as SpanHighlightCategory[]).map((cat) => (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-xs shrink-0 ${CATEGORY_STYLES[cat].swatchClass}`}
              aria-hidden="true"
            />
            <span>{CATEGORY_STYLES[cat].label}</span>
          </span>
        ))}
      </div>

      {/* Interactive Sentence Display */}
      <div className="p-4 bg-[#131B2E] border border-slate-800 rounded-lg text-sm sm:text-base leading-loose text-slate-100">
        {validSpans.length === 0 ? (
          <span>{text}</span>
        ) : (
          segments.map((seg) => {
            if (!seg.span) {
              return <span key={seg.key}>{seg.content}</span>;
            }
            const style = CATEGORY_STYLES[seg.span.category];
            const isSelected = selectedSpan?.id === seg.span.id;
            return (
              <button
                key={seg.key}
                type="button"
                onClick={() => setSelectedSpanId(seg.span!.id)}
                className={`${style.buttonClass} px-1 py-0.5 mx-0.5 rounded-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isSelected ? 'ring-2 ring-slate-200 ring-offset-1 ring-offset-[#131B2E]' : ''
                }`}
              >
                {seg.content}
              </button>
            );
          })
        )}
      </div>

      {/* Selected Span Details */}
      {selectedSpan ? (
        <div className="p-4 bg-[#11192D] border border-slate-800 rounded-lg grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          <div className="md:col-span-4 space-y-1">
            <p className="text-slate-400">Extracted Phrase</p>
            <p className="text-sm font-semibold text-white">"{selectedSpan.phrase}"</p>
            <p className="text-slate-400 pt-1">{selectedSpan.attributionSource}</p>
          </div>
          <div className="md:col-span-4 space-y-1">
            <p className="text-slate-400">Classification</p>
            <p className="font-medium text-slate-100">{selectedSpan.classification}</p>
            {selectedSpan.associatedAspect && (
              <p className="text-slate-300 pt-1">
                Associated Aspect:{' '}
                <span className="font-medium text-blue-300">{selectedSpan.associatedAspect}</span>
              </p>
            )}
          </div>
          <div className="md:col-span-4 space-y-1">
            <p className="text-slate-400">Short Explanation</p>
            <p className="text-slate-300 leading-relaxed">{selectedSpan.explanation}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">
          No localized opinion, aspect, or negation phrases required word-level highlighting in this
          statement.
        </p>
      )}
    </div>
  );
}
