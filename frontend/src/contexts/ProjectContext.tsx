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
  activeProject: Project;
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

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [projectsList, setProjectsList] = useState<Project[]>(() =>
    safeReadStorage<Project[]>(`${STORAGE_KEY}:projects`, DEFAULT_PROJECTS)
  );
  const [activeProject, setActiveProject] = useState<Project>(() =>
    safeReadStorage<Project>(`${STORAGE_KEY}:activeProject`, DEFAULT_PROJECTS[0])
  );

  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  // Entities state
  const [activities, setActivities] = useState<ActivityWithState[]>(() =>
    safeReadStorage<ActivityWithState[]>(
      `${STORAGE_KEY}:${activeProject.id}:activities`,
      initialActivities
    )
  );

  const [observations, setObservations] = useState<WorkObservation[]>(() =>
    safeReadStorage<WorkObservation[]>(
      `${STORAGE_KEY}:${activeProject.id}:observations`,
      getDefaultObservations(activeProject.id)
    )
  );

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() =>
    safeReadStorage<ReviewQueueItem[]>(
      `${STORAGE_KEY}:${activeProject.id}:reviewQueue`,
      getDefaultReviewQueue(activeProject.id, initialActivities)
    )
  );

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() =>
    safeReadStorage<AuditEvent[]>(
      `${STORAGE_KEY}:${activeProject.id}:auditEvents`,
      getDefaultAuditEvents(activeProject.id, user?.id)
    )
  );

  // Load live data for the active project
  // Load live data for the active project
  const loadData = useCallback(async (projectId?: string) => {
    const targetId = projectId || activeProject.id;
    try {
      // 1. Check Supabase connection
      const { error } = await supabase.auth.getSession();
      setSupabaseConnected(!error);

      // 2. Fetch Projects via Trust Plane API, fallback to DB
      const apiProjects = await api.getProjects();
      if (apiProjects && apiProjects.length > 0) {
        setProjectsList(apiProjects);
      } else {
        const dbProjects = await fetchProjects();
        if (dbProjects && dbProjects.length > 0) {
          setProjectsList(() => {
            const combined = [...dbProjects];
            DEFAULT_PROJECTS.forEach((dp) => {
              if (!combined.some((p) => p.id === dp.id || p.code === dp.code)) {
                combined.push(dp);
              }
            });
            return combined;
          });
        }
      }

      // 3. Fetch Data for Active Project via Trust Plane API
      const [liveActs, liveObs, liveQueue, liveAudits] = await Promise.all([
        api.getActivities(targetId),
        api.getObservations(targetId),
        api.getReviewQueue(targetId),
        api.getAuditTrail(targetId),
      ]);

      if (liveActs && liveActs.length > 0) {
        setActivities(liveActs);
      }
      if (liveObs && liveObs.length > 0) {
        setObservations(liveObs);
      }
      if (liveQueue && liveQueue.length > 0) {
        setReviewQueue(liveQueue);
      }
      if (liveAudits && liveAudits.length > 0) {
        setAuditEvents(liveAudits);
      }
    } catch (err) {
      console.warn('[NEXORA] Live fetch error, using local fallback:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject.id]);

  // Initial mount & project change effect
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      if (isMounted) {
        await loadData(activeProject.id);
      }
    };
    void fetchInitialData();

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
  }, [activeProject.id, loadData]);

  // Sync only client UI preferences (active project selection) to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:activeProject`, JSON.stringify(activeProject));
  }, [activeProject]);

  // Handle Project Selection
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

  const kpis: DashboardKPIs = {
    total_observations: observations.length,
    extracted_events: observations.length,
    auto_linked_events: activities.filter((a) => (a.state?.current_progress_pct || 0) > 0).length,
    review_queue_count: reviewQueue.length,
    unmatched_count: 0,
    completed_activities: completedCount,
    in_progress_activities: inProgressCount,
    overall_progress_pct: overallProgressPct,
  };

  // Add observation handler: updates local list and reloads authoritative state
  const handleAddObservations = useCallback(
    async (newObs: WorkObservation[], _rawText: string) => {
      if (newObs && newObs.length > 0) {
        setObservations((prev) => [newObs[0], ...prev]);
      }
      await loadData(activeProject.id);
    },
    [activeProject.id, loadData]
  );

  // Authoritative proposal approval via Rust Trust Plane API
  const handleApproveProposal = useCallback(
    async (proposalId: string, comment?: string) => {
      await api.approveProposal(proposalId, { comments: comment, reviewed_by: user?.id });
      await loadData(activeProject.id);
    },
    [activeProject.id, loadData, user?.id]
  );

  // Authoritative proposal rejection via Rust Trust Plane API
  const handleRejectProposal = useCallback(
    async (proposalId: string, reason?: string) => {
      await api.rejectProposal(proposalId, { reason: reason || 'Rejected by Lead Planner', reviewed_by: user?.id });
      await loadData(activeProject.id);
    },
    [activeProject.id, loadData, user?.id]
  );

  // Authoritative proposal override via Rust Trust Plane API
  const handleOverrideProposal = useCallback(
    async (proposalId: string, newActivityId: string, comment?: string) => {
      await api.overrideProposal(proposalId, {
        new_activity_id: newActivityId,
        reason: comment || 'Target overridden by Lead Planner',
        reviewed_by: user?.id,
      });
      await loadData(activeProject.id);
    },
    [activeProject.id, loadData, user?.id]
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
