import { Download, Menu } from 'lucide-react';
import { DashboardSection } from '../../types/absa';

interface TopBarProps {
  activeSection: DashboardSection;
  onOpenMobileMenu: () => void;
  onExportSampleReport: () => void;
}

const SECTION_TITLES: Record<DashboardSection, string> = {
  [DashboardSection.Overview]: 'Overview & Aspect Intelligence',
  [DashboardSection.Workbench]: 'Review Workbench',
  [DashboardSection.CsvIngestion]: 'Batch CSV Ingestion',
  [DashboardSection.Benchmarks]: 'SemEval-2014 Model Benchmarks',
  [DashboardSection.Architecture]: 'System Architecture',
};

export function TopBar({
  activeSection,
  onOpenMobileMenu,
  onExportSampleReport,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-400 whitespace-nowrap hidden sm:inline">AspectIQ</span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onExportSampleReport}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Export Sample Report</span>
        </button>
      </div>
    </header>
  );
}
