import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  ActivityWithState,
  AuditEvent,
  DashboardKPIs,
  Project,
  ReviewQueueItem,
  WorkObservation,
} from '../types';
import {
  DEFAULT_PROJECTS,
  initialActivities,
  getDefaultObservations,
  getDefaultReviewQueue,
  getDefaultAuditEvents,
  safeReadStorage,
  STORAGE_KEY,
} from '../data/demoData';
import {
  supabase,
  subscribeToProjectRealtime,
  fetchProjects,
} from '../lib/supabase';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  projectsList: Project[];
  activeProject: Project | null;
  isCreateProjectModalOpen: boolean;
  openCreateProjectModal: () => void;
  closeCreateProjectModal: () => void;
  selectProject: (project: Project) => void;
  handleProjectCreated: (newProject: Project) => void;
  activities: ActivityWithState[];
  observations: WorkObservation[];
  reviewQueue: ReviewQueueItem[];
  auditEvents: AuditEvent[];
  kpis: DashboardKPIs;
  isLoading: boolean;
  supabaseConnected: boolean;
  loadData: (projectId?: string) => Promise<void>;
  handleAddObservations: (newObs: WorkObservation[], rawText: string) => void;
  handleApproveProposal: (proposalId: string, comment?: string) => Promise<void>;
  handleRejectProposal: (proposalId: string, reason?: string) => Promise<void>;
  handleOverrideProposal: (proposalId: string, newActivityId: string, comment?: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const isDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [projectsList, setProjectsList] = useState<Project[]>(() =>
    safeReadStorage<Project[]>(`${STORAGE_KEY}:projects`, isDemoMode ? DEFAULT_PROJECTS : [])
  );
  const [activeProject, setActiveProject] = useState<Project | null>(() =>
    safeReadStorage<Project | null>(`${STORAGE_KEY}:activeProject`, isDemoMode ? DEFAULT_PROJECTS[0] : null)
  );

  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  // Entities state - initialized cleanly without polluting production runtime with demo entities
  const [activities, setActivities] = useState<ActivityWithState[]>(() => (isDemoMode ? initialActivities : []));
  const [observations, setObservations] = useState<WorkObservation[]>(() =>
    isDemoMode && activeProject ? getDefaultObservations(activeProject.id) : []
  );
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() =>
    isDemoMode && activeProject ? getDefaultReviewQueue(activeProject.id, initialActivities) : []
  );
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() =>
    isDemoMode && activeProject ? getDefaultAuditEvents(activeProject.id, user?.id) : []
  );
  const [backendKpis, setBackendKpis] = useState<DashboardKPIs | null>(null);

  // Load live data for the active project
  const loadData = useCallback(async (projectId?: string) => {
    try {
      // 1. Check Supabase connection
      const { error } = await supabase.auth.getSession();
      setSupabaseConnected(!error);

      // 2. Fetch Projects via Trust Plane API, fallback to Supabase DB query
      const apiProjects = await api.getProjects();
      let currentProjects: Project[] = [];
      if (apiProjects && apiProjects.length > 0) {
        setProjectsList(apiProjects);
        currentProjects = apiProjects;
      } else {
        const dbProjects = await fetchProjects();
        if (dbProjects && dbProjects.length > 0) {
          setProjectsList(dbProjects);
          currentProjects = dbProjects;
        } else {
          setProjectsList([]);
          currentProjects = [];
        }
      }

      const targetId = projectId || (currentProjects.find(p => p.id === activeProject?.id)?.id) || (currentProjects.length > 0 ? currentProjects[0].id : null);
      if (!targetId) {
        setActiveProject(null);
        setActivities([]);
        setObservations([]);
        setReviewQueue([]);
        setAuditEvents([]);
        setBackendKpis(null);
        return;
      }

      if (!activeProject || activeProject.id !== targetId) {
        const found = currentProjects.find((p) => p.id === targetId);
        if (found) {
          setActiveProject(found);
        }
      }

      // 3. Fetch Data for Active Project via Trust Plane API
      const [liveActs, liveObs, liveQueue, liveAudits, liveKpis] = await Promise.all([
        api.getActivities(targetId),
        api.getObservations(targetId),
        api.getReviewQueue(targetId),
        api.getAuditTrail(targetId),
        api.getDashboard(targetId),
      ]);

      setActivities(liveActs || []);
      setObservations(liveObs || []);
      setReviewQueue(liveQueue || []);
      setAuditEvents(liveAudits || []);
      if (liveKpis) {
        setBackendKpis(liveKpis);
      }
    } catch (err) {
      console.warn('[NEXORA] Live fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject, projectsList]);

  // Initial mount & project change effect
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      if (isMounted) {
        await loadData(activeProject?.id);
      }
    };
    void fetchInitialData();

    if (!activeProject?.id) return;

    // Subscribe to live Postgres change events
    const unsubscribe = subscribeToProjectRealtime(activeProject.id, {
      onObservationChange: () => void loadData(activeProject.id),
      onProposalChange: () => void loadData(activeProject.id),
      onStateChange: () => void loadData(activeProject.id),
      onAuditChange: () => void loadData(activeProject.id),
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeProject?.id, loadData]);

  // Save active project to local storage
  useEffect(() => {
    if (activeProject) {
      localStorage.setItem(`${STORAGE_KEY}:activeProject`, JSON.stringify(activeProject));
    }
  }, [activeProject]);

  // Save projects list to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:projects`, JSON.stringify(projectsList));
  }, [projectsList]);

  // Project Switcher Handler
  const selectProject = (project: Project) => {
    setActiveProject(project);
    setIsLoading(true);
  };

  // Handle Project Created
  const handleProjectCreated = (newProject: Project) => {
    setProjectsList((prev) => [newProject, ...prev]);
    setActiveProject(newProject);
    setIsLoading(true);
  };

  // KPI Calculations
  const completedCount = activities.filter((a) => a.state?.execution_status === 'COMPLETED').length;
  const inProgressCount = activities.filter((a) => a.state?.execution_status === 'IN_PROGRESS').length;
  const totalWeight = activities.reduce((acc, a) => acc + (a.activity.weightage || 1), 0);
  const weightedProgress = activities.reduce((acc, a) => {
    const progress = a.state?.current_progress_pct || 0;
    const weight = a.activity.weightage || 1;
    return acc + progress * weight;
  }, 0);
  const overallProgressPct = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

  const fallbackKpis: DashboardKPIs = {
    total_observations: observations.length,
    extracted_events: observations.length,
    auto_linked_events: activities.filter((a) => (a.state?.current_progress_pct || 0) > 0).length,
    review_queue_count: reviewQueue.length,
    unmatched_count: 0,
    completed_activities: completedCount,
    in_progress_activities: inProgressCount,
    overall_progress_pct: overallProgressPct,
  };

  const kpis: DashboardKPIs = backendKpis || fallbackKpis;

  // Add observation handler: updates local list and reloads authoritative state
  const handleAddObservations = useCallback(
    async (newObs: WorkObservation[], _rawText: string) => {
      if (newObs && newObs.length > 0) {
        setObservations((prev) => [newObs[0], ...prev]);
      }
      if (activeProject?.id) {
        await loadData(activeProject.id);
      }
    },
    [activeProject?.id, loadData]
  );

  // Authoritative proposal approval via Rust Trust Plane API (actor identity strictly from verified JWT)
  const handleApproveProposal = useCallback(
    async (proposalId: string, comment?: string) => {
      await api.approveProposal(proposalId, { comments: comment });
      if (activeProject?.id) {
        await loadData(activeProject.id);
      }
    },
    [activeProject?.id, loadData]
  );

  // Authoritative proposal rejection via Rust Trust Plane API (actor identity strictly from verified JWT)
  const handleRejectProposal = useCallback(
    async (proposalId: string, reason?: string) => {
      await api.rejectProposal(proposalId, { reason: reason || 'Rejected by Lead Planner' });
      if (activeProject?.id) {
        await loadData(activeProject.id);
      }
    },
    [activeProject?.id, loadData]
  );

  // Authoritative proposal override via Rust Trust Plane API (actor identity strictly from verified JWT)
  const handleOverrideProposal = useCallback(
    async (proposalId: string, newActivityId: string, comment?: string) => {
      await api.overrideProposal(proposalId, {
        new_activity_id: newActivityId,
        reason: comment || 'Target overridden by Lead Planner',
      });
      if (activeProject?.id) {
        await loadData(activeProject.id);
      }
    },
    [activeProject?.id, loadData]
  );

  return (
    <ProjectContext.Provider
      value={{
        projectsList,
        activeProject,
        isCreateProjectModalOpen,
        openCreateProjectModal: () => setIsCreateProjectModalOpen(true),
        closeCreateProjectModal: () => setIsCreateProjectModalOpen(false),
        selectProject,
        handleProjectCreated,
        activities,
        observations,
        reviewQueue,
        auditEvents,
        kpis,
        isLoading,
        supabaseConnected,
        loadData,
        handleAddObservations,
        handleApproveProposal,
        handleRejectProposal,
        handleOverrideProposal,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextType {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
