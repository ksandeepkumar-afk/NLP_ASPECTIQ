import { ArrowRight, type LucideIcon } from 'lucide-react';

interface WorkspaceCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onSelect: () => void;
}

export function WorkspaceCard({
  title,
  description,
  icon: Icon,
  onSelect,
}: WorkspaceCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group text-left h-full flex flex-col justify-between p-6 rounded-xl bg-[#0D1322] border border-slate-800/90 hover:border-blue-500/60 hover:bg-[#11192D] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="space-y-4">
        <div className="w-10 h-10 rounded-lg bg-[#131B2E] border border-slate-800 group-hover:border-blue-500/40 group-hover:bg-blue-500/10 flex items-center justify-center transition-colors">
          <Icon
            className="w-5 h-5 text-blue-400 group-hover:text-violet-300 transition-colors shrink-0"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-base font-semibold text-slate-100 group-hover:text-white transition-colors">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="pt-6 mt-4 border-t border-slate-800/70 flex items-center justify-between text-xs font-medium text-slate-400 group-hover:text-blue-300 transition-colors">
        <span>Open workspace</span>
        <ArrowRight
          className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-150 shrink-0"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
