import { ArrowLeft, Download, FileSpreadsheet, Menu } from 'lucide-react';
import { DashboardSection } from '../../types/absa';

interface TopBarProps {
  activeSection: DashboardSection;
  hasBatchResults: boolean;
  onOpenMobileMenu: () => void;
  onBackToWorkspaces: () => void;
  onPrimaryAction: () => void;
}

const SECTION_TITLES: Record<DashboardSection, string> = {
  [DashboardSection.Workbench]: 'Statement Analyzer',
  [DashboardSection.BatchIngestion]: 'Batch Intelligence',
  [DashboardSection.Conversation]: 'Conversation Analyzer',
  [DashboardSection.Benchmarks]: 'Model Comparison',
  [DashboardSection.Analytics]: 'Analytics & Insights',
  [DashboardSection.History]: 'Analysis History',
};

export function TopBar({
  activeSection,
  hasBatchResults,
  onOpenMobileMenu,
  onBackToWorkspaces,
  onPrimaryAction,
}: TopBarProps) {
  return (
    <header className="h-16 bg-[#0A0F1C]/90 backdrop-blur-sm border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between gap-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-slate-400 hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            type="button"
            onClick={onBackToWorkspaces}
            className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-100 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Workspaces</span>
          </button>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-100 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F1C]"
        >
          {hasBatchResults ? (
            <>
              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Export Batch CSV</span>
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Batch Intelligence</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
