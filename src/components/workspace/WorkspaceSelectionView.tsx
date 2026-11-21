import {
  ArrowLeft,
  BarChart3,
  Cpu,
  FileSpreadsheet,
  History,
  MessageSquareText,
  MessagesSquare,
} from 'lucide-react';
import { DashboardSection } from '../../types/absa';
import { WorkspaceCard } from './WorkspaceCard';

interface WorkspaceSelectionViewProps {
  onSelectModule: (section: DashboardSection) => void;
  onBackToWelcome: () => void;
}

const WORKSPACE_MODULES: Array<{
  section: DashboardSection;
  title: string;
  description: string;
  icon: typeof MessageSquareText;
}> = [
  {
    section: DashboardSection.Workbench,
    title: 'Statement Analyzer',
    description:
      'Analyze individual statements for sentiment, tone, emotion, intent, and aspects.',
    icon: MessageSquareText,
  },
  {
    section: DashboardSection.BatchIngestion,
    title: 'Batch Intelligence',
    description: 'Analyze multiple statements or reviews using CSV uploads.',
    icon: FileSpreadsheet,
  },
  {
    section: DashboardSection.Conversation,
    title: 'Conversation Analyzer',
    description:
      'Understand conversations, speaker interactions, sentiment changes, and discussion patterns.',
    icon: MessagesSquare,
  },
  {
    section: DashboardSection.Benchmarks,
    title: 'Model Comparison',
    description: 'Compare NLP models using genuine evaluation metrics and datasets.',
    icon: Cpu,
  },
  {
    section: DashboardSection.Analytics,
    title: 'Analytics and Insights',
    description: 'Explore sentiment distributions, trends, topics, and analytical summaries.',
    icon: BarChart3,
  },
  {
    section: DashboardSection.History,
    title: 'Analysis History',
    description: 'Access, search, filter, and manage previous analyses.',
    icon: History,
  },
];

export function WorkspaceSelectionView({
  onSelectModule,
  onBackToWelcome,
}: WorkspaceSelectionViewProps) {
  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 relative overflow-hidden flex flex-col">
      {/* Subtle Ambient Accents */}
      <div
        className="pointer-events-none absolute -top-32 right-0 w-[480px] h-[480px] rounded-full bg-violet-600/10 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 -left-24 w-[440px] h-[440px] rounded-full bg-blue-600/10 blur-[120px]"
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 h-16 border-b border-slate-800/80 bg-[#0A0F1C]/90 backdrop-blur-sm px-6 sm:px-10 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={onBackToWelcome}
          className="font-display text-base font-bold tracking-wider text-slate-100 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        >
          ASPECTIQ
        </button>

        <button
          type="button"
          onClick={onBackToWelcome}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Back to Welcome</span>
        </button>
      </header>

      {/* Workspace Grid */}
      <main className="relative z-10 flex-1 w-full max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 space-y-10">
        <div className="space-y-2 animate-enter">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Welcome to AspectIQ
          </h1>
          <p className="text-sm sm:text-base text-slate-400">
            Choose an intelligence workspace to get started.
          </p>
        </div>

        <section
          aria-label="Intelligence Workspaces"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-enter-delay-1"
        >
          {WORKSPACE_MODULES.map((mod) => (
            <WorkspaceCard
              key={mod.section}
              title={mod.title}
              description={mod.description}
              icon={mod.icon}
              onSelect={() => onSelectModule(mod.section)}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
