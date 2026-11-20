import {
  BarChart3,
  Cpu,
  FileSpreadsheet,
  Layers,
  Microscope,
  X,
} from 'lucide-react';
import { DashboardSection } from '../../types/absa';

interface SidebarProps {
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: DashboardSection;
  label: string;
  icon: typeof BarChart3;
}

const NAV_ITEMS: NavItem[] = [
  { id: DashboardSection.Overview, label: 'Overview', icon: BarChart3 },
  { id: DashboardSection.Workbench, label: 'Review Workbench', icon: Microscope },
  { id: DashboardSection.CsvIngestion, label: 'Batch CSV Ingestion', icon: FileSpreadsheet },
  { id: DashboardSection.Benchmarks, label: 'Model Benchmarks', icon: Cpu },
  { id: DashboardSection.Architecture, label: 'System Architecture', icon: Layers },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const handleSelect = (id: DashboardSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-150 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Primary Sidebar Navigation"
      >
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => handleSelect(DashboardSection.Overview)}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              AspectIQ
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            className="p-2 text-slate-500 hover:text-slate-900 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'bg-blue-50 text-blue-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-blue-700' : 'text-slate-400'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-5 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <p className="font-medium text-slate-700">Academic Project Scope</p>
          <p className="leading-relaxed">
            Initial dashboard structure using clearly labelled sample data. Live ML training and
            inference will connect in subsequent phases.
          </p>
        </div>
      </aside>
    </>
  );
}
