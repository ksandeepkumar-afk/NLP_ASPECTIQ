import { useCallback, useEffect, useState } from 'react';
import { AnalyticsInsightsView } from './components/analytics/AnalyticsInsightsView';
import { ConversationAnalyzerView } from './components/conversation/ConversationAnalyzerView';
import { AnalysisHistoryView } from './components/history/AnalysisHistoryView';
import { BatchIntelligenceView } from './components/ingestion/BatchIntelligenceView';
import { WelcomeLandingView } from './components/landing/WelcomeLandingView';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { ModelBenchmarksView } from './components/models/ModelBenchmarksView';
import { ReviewWorkbench } from './components/workbench/ReviewWorkbench';
import { WorkspaceSelectionView } from './components/workspace/WorkspaceSelectionView';
import { exportPredictionsCsv } from './services/reportExport';
import {
  BatchAnalysisResult,
  ConversationAnalysisResult,
  DashboardSection,
  ParsedCsvDocument,
  StatementAnalysisOutput,
} from './types/absa';
import {
  getPathForRoute,
  parseRouteFromLocation,
  RouteState,
} from './utils/navigation';

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRouteFromLocation());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Preserved Layer 3 module state & drafts so switching modules or returning to Workspace Selection never loses unsaved input
  const [statementDraft, setStatementDraft] = useState('');
  const [statementResult, setStatementResult] = useState<StatementAnalysisOutput | null>(null);
  const [reopenedStatement, setReopenedStatement] =
    useState<StatementAnalysisOutput | null>(null);

  const [batchDraftText, setBatchDraftText] = useState('');
  const [batchParsedDoc, setBatchParsedDoc] = useState<ParsedCsvDocument | null>(null);
  const [activeBatch, setActiveBatch] = useState<BatchAnalysisResult | null>(null);

  const [conversationTitleDraft, setConversationTitleDraft] = useState(
    'Customer Support Thread'
  );
  const [conversationPastedDraft, setConversationPastedDraft] = useState('');
  const [activeConversation, setActiveConversation] =
    useState<ConversationAnalysisResult | null>(null);

  const navigateTo = useCallback((nextRoute: RouteState, replace = false) => {
    const targetPath = getPathForRoute(nextRoute);
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState(nextRoute, '', targetPath);
      } else {
        window.history.pushState(nextRoute, '', targetPath);
      }
    }
    setRoute(nextRoute);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parseRouteFromLocation(window.location.pathname));
      setMobileMenuOpen(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenWorkspaces = () => {
    navigateTo({ layer: 'workspace', section: route.section });
  };

  const handleBackToWelcome = () => {
    navigateTo({ layer: 'welcome', section: route.section });
  };

  const handleSelectModule = (section: DashboardSection) => {
    navigateTo({ layer: 'module', section });
  };

  const handleBatchCleared = () => {
    setActiveBatch(null);
  };

  const handleBatchAnalyzed = (result: BatchAnalysisResult) => {
    setActiveBatch(result);
  };

  const handleReopenStatement = (stmt: StatementAnalysisOutput) => {
    setReopenedStatement(stmt);
    setStatementDraft(stmt.originalText);
    setStatementResult(stmt);
    navigateTo({ layer: 'module', section: DashboardSection.Workbench });
  };

  const handleReopenBatch = (batch: BatchAnalysisResult) => {
    setActiveBatch(batch);
    navigateTo({ layer: 'module', section: DashboardSection.BatchIngestion });
  };

  const handleReopenConversation = (conv: ConversationAnalysisResult) => {
    setActiveConversation(conv);
    navigateTo({ layer: 'module', section: DashboardSection.Conversation });
  };

  const handleTopBarPrimaryAction = () => {
    if (activeBatch) {
      exportPredictionsCsv(activeBatch);
    } else {
      handleSelectModule(DashboardSection.BatchIngestion);
    }
  };

  // Layer 1: Welcome / Landing Page
  if (route.layer === 'welcome') {
    return <WelcomeLandingView onGetStarted={handleOpenWorkspaces} />;
  }

  // Layer 2: Workspace / Module Selection
  if (route.layer === 'workspace') {
    return (
      <WorkspaceSelectionView
        onSelectModule={handleSelectModule}
        onBackToWelcome={handleBackToWelcome}
      />
    );
  }

  // Layer 3: Existing Application Modules
  const activeSection = route.section;

  return (
    <div className="min-h-screen flex bg-[#070B14] text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={handleSelectModule}
        onBackToWorkspaces={handleOpenWorkspaces}
        onBackToWelcome={handleBackToWelcome}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          hasBatchResults={activeBatch !== null}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onBackToWorkspaces={handleOpenWorkspaces}
          onPrimaryAction={handleTopBarPrimaryAction}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === DashboardSection.Workbench && (
            <ReviewWorkbench
              initialStatement={reopenedStatement}
              draftText={statementDraft}
              onDraftTextChange={setStatementDraft}
              savedResult={statementResult}
              onSavedResultChange={setStatementResult}
              onNavigateSection={handleSelectModule}
            />
          )}

          {activeSection === DashboardSection.BatchIngestion && (
            <BatchIntelligenceView
              activeBatch={activeBatch}
              onBatchCleared={handleBatchCleared}
              onBatchAnalyzed={handleBatchAnalyzed}
              draftManualText={batchDraftText}
              onDraftManualTextChange={setBatchDraftText}
              savedParsedDoc={batchParsedDoc}
              onSavedParsedDocChange={setBatchParsedDoc}
            />
          )}

          {activeSection === DashboardSection.Conversation && (
            <ConversationAnalyzerView
              activeConversation={activeConversation}
              onConversationAnalyzed={setActiveConversation}
              draftTitle={conversationTitleDraft}
              onDraftTitleChange={setConversationTitleDraft}
              draftPastedText={conversationPastedDraft}
              onDraftPastedTextChange={setConversationPastedDraft}
            />
          )}

          {activeSection === DashboardSection.Benchmarks && <ModelBenchmarksView />}

          {activeSection === DashboardSection.Analytics && (
            <AnalyticsInsightsView
              activeBatch={activeBatch}
              onNavigate={handleSelectModule}
            />
          )}

          {activeSection === DashboardSection.History && (
            <AnalysisHistoryView
              onReopenStatement={handleReopenStatement}
              onReopenBatch={handleReopenBatch}
              onReopenConversation={handleReopenConversation}
            />
          )}
        </main>
      </div>
    </div>
  );
}
