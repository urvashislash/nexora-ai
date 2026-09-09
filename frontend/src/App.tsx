import { lazy, Suspense, useState, useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeamProvider, useTeam } from './contexts/TeamContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { AppLayout } from './components/AppLayout';
import { DashboardSkeleton } from './components/SkeletonLoader';
import { Dashboard } from './pages/Dashboard';
import { STORAGE_KEY, safeReadStorage } from './data/demoData';

const ProjectGraph = lazy(() =>
  import('./pages/ProjectGraph').then(({ ProjectGraph }) => ({ default: ProjectGraph }))
);
const DocumentUpload = lazy(() =>
  import('./pages/DocumentUpload').then(({ DocumentUpload }) => ({ default: DocumentUpload }))
);
const ReviewQueue = lazy(() =>
  import('./pages/ReviewQueue').then(({ ReviewQueue }) => ({ default: ReviewQueue }))
);
const ScheduleExplorer = lazy(() =>
  import('./pages/ScheduleExplorer').then(({ ScheduleExplorer }) => ({ default: ScheduleExplorer }))
);
const AuditTrail = lazy(() =>
  import('./pages/AuditTrail').then(({ AuditTrail }) => ({ default: AuditTrail }))
);
const ScheduleExport = lazy(() =>
  import('./pages/ScheduleExport').then(({ ScheduleExport }) => ({ default: ScheduleExport }))
);
const SystemHealth = lazy(() =>
  import('./pages/SystemHealth').then(({ SystemHealth }) => ({ default: SystemHealth }))
);
const TeamSettings = lazy(() =>
  import('./pages/TeamSettings').then(({ TeamSettings }) => ({ default: TeamSettings }))
);
const Onboarding = lazy(() =>
  import('./components/Onboarding').then(({ Onboarding }) => ({ default: Onboarding }))
);
const ThankYou = lazy(() =>
  import('./pages/ThankYou').then(({ ThankYou }) => ({ default: ThankYou }))
);
const NotFound = lazy(() =>
  import('./pages/NotFound').then(({ NotFound }) => ({ default: NotFound }))
);

type Theme = 'light' | 'dark';
const isDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

function AppRoutes({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const { user } = useAuth();
  const { teamsList, isLoading: isTeamLoading } = useTeam();
  const {
    activities,
    observations,
    reviewQueue,
    auditEvents,
    kpis,
    activeProject,
    isLoading,
    loadData,
    openCreateProjectModal,
    handleAddObservations,
    handleApproveProposal,
    handleRejectProposal,
    handleOverrideProposal,
  } = useProject();

  if (user && !isDemoMode && !isTeamLoading && teamsList.length === 0) {
    return (
      <Suspense fallback={<DashboardSkeleton />}>
        <Onboarding
          onComplete={() => setActiveTab('dashboard')}
          onNavigateTab={setActiveTab}
        />
      </Suspense>
    );
  }

  if (isLoading && (!activeProject || activities.length === 0)) {
    return <DashboardSkeleton />;
  }

  if (!isLoading && !activeProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200/80 flex items-center justify-center mb-4 text-2xl font-bold shadow-2xs">
          +
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-1 font-sans">No Projects Configured</h2>
        <p className="text-xs text-slate-500 max-w-sm mb-6 font-sans">
          The Trust Plane currently has no registered projects. Provision a project with schedule WBS to begin recording field observations.
        </p>
        <button
          type="button"
          onClick={openCreateProjectModal}
          className="px-4 py-2 bg-[#C38B4B] hover:bg-[#b07b3e] text-white text-xs font-semibold rounded-xl shadow-xs transition duration-150"
        >
          Provision Project
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      {activeTab === 'dashboard' && (
        <Dashboard 
          kpis={kpis} 
          activities={activities} 
          project={activeProject}
          reviewQueue={reviewQueue}
          observations={observations}
          onNavigateTab={setActiveTab} 
        />
      )}
      {activeTab === 'graph' && (
        <ProjectGraph
          activities={activities}
          observations={observations}
          project={activeProject!}
        />
      )}
      {activeTab === 'upload' && (
        <DocumentUpload
          observations={observations}
          onAddObservations={handleAddObservations}
          onNavigateTab={setActiveTab}
          projectId={activeProject?.id || ''}
        />
      )}
      {activeTab === 'review' && (
        <ReviewQueue
          items={reviewQueue}
          activities={activities.map((a) => a.activity)}
          onApprove={handleApproveProposal}
          onReject={handleRejectProposal}
          onOverride={handleOverrideProposal}
        />
      )}
      {activeTab === 'schedule' && <ScheduleExplorer activities={activities} />}
      {activeTab === 'audit' && <AuditTrail events={auditEvents} />}
      {activeTab === 'team-settings' && <TeamSettings />}
      {activeTab === 'health' && <SystemHealth />}
      {activeTab === 'export' && (
        <ScheduleExport
          activities={activities}
          observations={observations}
          onRefreshData={async () => {
            if (activeProject) {
              await loadData(activeProject.id);
            }
          }}
          activeProject={activeProject || undefined}
        />
      )}
      {activeTab === 'thank-you' && <ThankYou onNavigateTab={setActiveTab as any} />}
      {!['dashboard', 'graph', 'upload', 'review', 'schedule', 'audit', 'team-settings', 'health', 'export', 'thank-you'].includes(
        activeTab
      ) && <NotFound onNavigateHome={() => setActiveTab('dashboard')} />}
    </Suspense>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [theme, setTheme] = useState<Theme>(() =>
    safeReadStorage<Theme>(
      `${STORAGE_KEY}:theme`,
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    )
  );

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:theme`, theme);
    document.documentElement.style.colorScheme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F5F6F8');
  }, [theme]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TeamProvider>
          <ProjectProvider>
            <AppLayout
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              theme={theme}
              setTheme={setTheme}
            >
              <AppRoutes activeTab={activeTab} setActiveTab={setActiveTab} />
            </AppLayout>
          </ProjectProvider>
        </TeamProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
