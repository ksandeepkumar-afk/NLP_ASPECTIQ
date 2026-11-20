import { useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { OverviewDashboard } from './components/overview/OverviewDashboard';
import { ReviewWorkbench } from './components/workbench/ReviewWorkbench';
import { CsvUploadView } from './components/ingestion/CsvUploadView';
import { ModelBenchmarksView } from './components/models/ModelBenchmarksView';
import { ArchitectureView } from './components/architecture/ArchitectureView';
import { SAMPLE_REVIEWS } from './data/sampleDataset';
import { exportSampleJsonReport } from './services/reportExport';
import { DashboardSection } from './types/absa';

export default function App() {
  const [activeSection, setActiveSection] = useState<DashboardSection>(DashboardSection.Overview);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_REVIEWS[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleInspectReview = (reviewId: string) => {
    setSelectedSampleId(reviewId);
    setActiveSection(DashboardSection.Workbench);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onExportSampleReport={() => exportSampleJsonReport(SAMPLE_REVIEWS)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeSection === DashboardSection.Overview && (
            <OverviewDashboard
              sampleReviews={SAMPLE_REVIEWS}
              onNavigate={setActiveSection}
              onInspectReview={handleInspectReview}
            />
          )}

          {activeSection === DashboardSection.Workbench && (
            <ReviewWorkbench
              sampleReviews={SAMPLE_REVIEWS}
              selectedSampleId={selectedSampleId}
              onSelectSampleId={setSelectedSampleId}
            />
          )}

          {activeSection === DashboardSection.CsvIngestion && <CsvUploadView />}

          {activeSection === DashboardSection.Benchmarks && <ModelBenchmarksView />}

          {activeSection === DashboardSection.Architecture && <ArchitectureView />}
        </main>
      </div>
    </div>
  );
}
