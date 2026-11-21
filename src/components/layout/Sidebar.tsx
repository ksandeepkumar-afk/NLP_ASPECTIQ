import {
  ArrowLeft,
  BarChart3,
  Cpu,
  FileSpreadsheet,
  History,
  LayoutGrid,
  MessageSquareText,
  MessagesSquare,
  X,
} from 'lucide-react';
import { DashboardSection } from '../../types/absa';

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onBackToWorkspaces: () => void;
  onBackToWelcome: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: DashboardSection;
  label: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { id: DashboardSection.Workbench, label: 'Statement Analyzer', icon: MessageSquareText },
  { id: DashboardSection.BatchIngestion, label: 'Batch Intelligence', icon: FileSpreadsheet },
  { id: DashboardSection.Conversation, label: 'Conversation Analyzer', icon: MessagesSquare },
  { id: DashboardSection.Benchmarks, label: 'Model Comparison', icon: Cpu },
  { id: DashboardSection.Analytics, label: 'Analytics & Insights', icon: BarChart3 },
  { id: DashboardSection.History, label: 'Analysis History', icon: History },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  onBackToWorkspaces,
  onBackToWelcome,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (id: DashboardSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const handleWorkspaces = () => {
    onBackToWorkspaces();
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0F1C] border-r border-slate-800/80 flex flex-col transition-transform duration-150 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary Sidebar Navigation"
      >
        <div className="h-16 px-6 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onBackToWelcome}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <span className="font-display text-base font-bold tracking-wider text-white whitespace-nowrap">
              ASPECTIQ
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-2 text-slate-400 hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pt-4 pb-2 border-b border-slate-800/60">
          <button
            type="button"
            onClick={handleWorkspaces}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-[#11192D] hover:bg-slate-800/80 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="inline-flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-hidden="true" />
              <span>All Workspaces</span>
            </span>
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/15 text-blue-200 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#11192D] border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-400' : 'text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-5 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          <p className="font-medium text-slate-200">Domain-Independent NLP</p>
          <p className="leading-relaxed">
            Multi-dimensional sentiment, tone, emotion, intent, sarcasm, negation, and
            dynamic aspect intelligence across arbitrary text.
          </p>
        </div>
      </aside>
    </>
  );
}
