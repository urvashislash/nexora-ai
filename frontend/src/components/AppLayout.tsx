import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Menu, Moon, Sun, MessageSquare } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { ProjectSelector } from './ProjectSelector';
import { TeamSelector } from './TeamSelector';
import { Toaster } from './ui/sonner';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';
import { useTeam } from '../contexts/TeamContext';
import type { UserRole } from '../types';

const CommandPalette = lazy(() =>
  import('./CommandPalette').then(({ CommandPalette }) => ({ default: CommandPalette }))
);
const AuthModal = lazy(() =>
  import('./AuthModal').then(({ AuthModal }) => ({ default: AuthModal }))
);
const JwtInspectorModal = lazy(() =>
  import('./JwtInspectorModal').then(({ JwtInspectorModal }) => ({ default: JwtInspectorModal }))
);
const CreateProjectModal = lazy(() =>
  import('./CreateProjectModal').then(({ CreateProjectModal }) => ({ default: CreateProjectModal }))
);
const CreateTeamModal = lazy(() =>
  import('./CreateTeamModal').then(({ CreateTeamModal }) => ({ default: CreateTeamModal }))
);
const FeedbackModal = lazy(() =>
  import('./FeedbackModal').then(({ FeedbackModal }) => ({ default: FeedbackModal }))
);
const LegalModal = lazy(() =>
  import('./LegalModal').then(({ LegalModal }) => ({ default: LegalModal }))
);
const AccountModal = lazy(() =>
  import('./AccountModal').then(({ AccountModal }) => ({ default: AccountModal }))
);

interface AppLayoutProps {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
}

export function AppLayout({
  children,
  activeTab,
  setActiveTab,
  theme,
  setTheme,
}: AppLayoutProps) {
  const {
    user,
    jwtToken,
    currentRole,
    setCurrentRole,
    setUser,
    isAuthModalOpen,
    isJwtModalOpen,
    openAuthModal,
    closeAuthModal,
    openJwtModal,
    closeJwtModal,
    handleAuthSuccess,
    handleLogout,
  } = useAuth();

  const {
    projectsList,
    activeProject,
    selectProject,
    isCreateProjectModalOpen,
    openCreateProjectModal,
    closeCreateProjectModal,
    handleProjectCreated,
    reviewQueue,
    activities,
    isLoading,
    supabaseConnected,
  } = useProject();

  const { isCreateTeamModalOpen, closeCreateTeamModal } = useTeam();

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

  return (
    <div
      className={`${
        theme === 'dark' ? 'dark bg-slate-950' : 'bg-[#F5F6F8]'
      } flex min-h-screen text-slate-900 font-sans selection:bg-[#C38B4B]/20 selection:text-[#C38B4B]`}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {isMobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-slate-950/35 lg:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileNavOpen(false);
        }}
        pendingReviewCount={reviewQueue.length}
        activeProject={activeProject || undefined}
        user={user}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onOpenAuth={openAuthModal}
        onOpenJwt={openJwtModal}
        onOpenAccount={() => setIsAccountModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Operating Surface */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 lg:pl-64">
        {/* In-product Beta Disclaimer Banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2 text-xs font-sans text-amber-950 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-950 tracking-wider uppercase font-mono">
              Beta
            </span>
            <span className="text-[11px] sm:text-xs">
              <strong>NEXORA Beta:</strong> AI-generated matches are suggestions and require human verification before being committed to project records.
            </span>
          </div>
          <span className="text-[10px] text-amber-800/80 font-mono hidden md:inline">
            v0.1.0-beta.1
          </span>
        </div>

        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-200/80 bg-white px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex min-w-0 items-center space-x-2.5 text-xs font-sans">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={isMobileNavOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Global Team Switcher Dropdown */}
            <TeamSelector onOpenSettings={() => setActiveTab('team-settings')} />

            {/* Global Project Switcher Dropdown */}
            <ProjectSelector
              projects={projectsList}
              activeProject={activeProject}
              onSelectProject={selectProject}
              onOpenCreateProject={openCreateProjectModal}
            />

            <span className="hidden text-slate-300 font-normal sm:inline">/</span>
            <span className="hidden font-semibold text-slate-800 tracking-tight sm:inline">
              {activeTab === 'dashboard'
                ? 'Overview'
                : activeTab === 'graph'
                ? 'Dependencies'
                : activeTab === 'upload'
                ? 'Evidence'
                : activeTab === 'review'
                ? 'Planner Review'
                : activeTab === 'schedule'
                ? 'Schedule'
                : activeTab === 'audit'
                ? 'Audit Ledger'
                : activeTab === 'team-settings'
                ? 'Team Settings'
                : activeTab === 'health'
                ? 'System Health'
                : activeTab === 'export'
                ? 'Exports'
                : 'Overview'}
            </span>
          </div>

          <div className="flex shrink-0 items-center space-x-2 sm:space-x-3 text-xs font-sans">
            {/* Feedback Button */}
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/80 rounded-lg text-xs transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 font-sans font-medium"
              title="Give Beta Feedback or Report an Issue"
            >
              <MessageSquare className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              <span className="hidden sm:inline">Feedback</span>
            </button>

            {/* Quick Command Palette Button */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Open command palette (Command+K)"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/90 rounded-lg text-slate-700 transition-all duration-150 cursor-pointer active:scale-[0.98] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <kbd className="px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-slate-700 shadow-2xs border border-slate-200/60 font-sans">
                ⌘K
              </kbd>
              <span className="text-[11px] font-medium text-slate-700">Quick Commands</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Active User Role Indicator / JWT Modal Trigger */}
            <button
              type="button"
              onClick={openJwtModal}
              aria-label={`Inspect JWT claims for ${
                user?.role ? user.role.replace(/_/g, ' ') : currentRole.replace(/_/g, ' ')
              }`}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 transition-all duration-150 hover:bg-slate-200/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500"
              title="Inspect cryptographic JWT token"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C38B4B]" aria-hidden="true" />
              <span className="text-[11px] font-medium tracking-tight text-slate-800">
                {user?.role ? user.role.replace(/_/g, ' ') : currentRole.replace(/_/g, ' ')}
              </span>
            </button>

            <div className="hidden sm:flex items-center space-x-1.5 text-xs font-sans">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  supabaseConnected ? 'bg-[#34C759]' : 'bg-[#D97706]'
                }`}
                aria-hidden="true"
              />
              <span className="text-slate-700 hidden lg:inline font-medium text-[11px]">
                {supabaseConnected ? 'Cloud Sync Active' : 'Local Standby'}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C38B4B] animate-pulse" />
          )}
        </header>

        {/* Dynamic Content Surface */}
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          {children}
        </div>

        {/* Footer with Compliance & Support Links */}
        <footer className="mt-auto border-t border-slate-200/70 py-4 px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-sans bg-white/50">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">NEXORA Beta</span>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setIsLegalModalOpen(true)}
              className="hover:text-slate-800 underline transition cursor-pointer"
            >
              Privacy &amp; Terms
            </button>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setIsFeedbackModalOpen(true)}
              className="hover:text-slate-800 underline transition cursor-pointer"
            >
              Support &amp; Feedback
            </button>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Zero-Retention AI</span>
            <span>&bull;</span>
            <span>SHA-256 Ledger</span>
          </div>
        </footer>

        {/* Modals */}
        <Suspense fallback={null}>
          {isCommandPaletteOpen && (
            <CommandPalette
              isOpen={isCommandPaletteOpen}
              onClose={() => setIsCommandPaletteOpen(false)}
              onNavigateTab={setActiveTab}
              activities={activities}
              currentRole={user?.role || currentRole}
              onSelectRole={(r: string) => {
                const role = r as UserRole;
                setCurrentRole(role);
                if (user) setUser({ ...user, role });
              }}
            />
          )}

          {isAuthModalOpen && (
            <AuthModal
              isOpen={isAuthModalOpen}
              onClose={closeAuthModal}
              onAuthSuccess={handleAuthSuccess}
            />
          )}

          {isJwtModalOpen && (
            <JwtInspectorModal
              isOpen={isJwtModalOpen}
              onClose={closeJwtModal}
              token={jwtToken}
              user={user}
            />
          )}

          {isCreateProjectModalOpen && (
            <CreateProjectModal
              isOpen={isCreateProjectModalOpen}
              onClose={closeCreateProjectModal}
              onProjectCreated={handleProjectCreated}
              userId={user?.id}
            />
          )}

          {isCreateTeamModalOpen && (
            <CreateTeamModal
              isOpen={isCreateTeamModalOpen}
              onClose={closeCreateTeamModal}
            />
          )}

          {isFeedbackModalOpen && (
            <FeedbackModal
              isOpen={isFeedbackModalOpen}
              onClose={() => setIsFeedbackModalOpen(false)}
              activeTab={activeTab}
            />
          )}

          {isLegalModalOpen && (
            <LegalModal
              isOpen={isLegalModalOpen}
              onClose={() => setIsLegalModalOpen(false)}
            />
          )}

          {isAccountModalOpen && (
            <AccountModal
              isOpen={isAccountModalOpen}
              onClose={() => setIsAccountModalOpen(false)}
            />
          )}
        </Suspense>

        {/* Global Toast Notifications */}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}
