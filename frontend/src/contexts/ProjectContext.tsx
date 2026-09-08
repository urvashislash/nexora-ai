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
  fetchProjectActivities,
  fetchProjectObservations,
  fetchProjectProposals,
  fetchProjectAuditEvents,
} from '../lib/supabase';
import { generateUUIDv7, generateAuditPayloadHash } from '../lib/idGenerator';
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
  const loadData = useCallback(async (projectId?: string) => {
    const targetId = projectId || activeProject.id;
    try {
      // 1. Check Supabase connection
      const { error } = await supabase.auth.getSession();
      setSupabaseConnected(!error);

      // 2. Fetch Projects from DB if available
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

      // 3. Fetch Data for Active Project
      const [liveActs, liveObs, liveProposals, liveAudits] = await Promise.all([
        fetchProjectActivities(targetId),
        fetchProjectObservations(targetId),
        fetchProjectProposals(targetId),
        fetchProjectAuditEvents(targetId),
      ]);

      if (liveActs && liveActs.length > 0) {
        setActivities(liveActs);
      }
      if (liveObs && liveObs.length > 0) {
        setObservations(liveObs);
      }
      if (liveProposals && liveProposals.length > 0) {
        const queueItems: ReviewQueueItem[] = liveProposals.map((p) => ({
          proposal: p,
          observation: liveObs?.find((o) => o.id === p.observation_id),
          activity: liveActs?.find((a) => a.activity.id === p.activity_id)?.activity,
        }));
        setReviewQueue(queueItems);
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

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:activeProject`, JSON.stringify(activeProject));
    localStorage.setItem(`${STORAGE_KEY}:projects`, JSON.stringify(projectsList));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:activities`, JSON.stringify(activities));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:observations`, JSON.stringify(observations));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:reviewQueue`, JSON.stringify(reviewQueue));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:auditEvents`, JSON.stringify(auditEvents));
  }, [activeProject, projectsList, activities, observations, reviewQueue, auditEvents]);

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

  // Add observation handler
  const handleAddObservations = useCallback(
    (newObs: WorkObservation[], rawText: string) => {
      setObservations((prev) => [newObs[0], ...prev]);

      // Fast-path auto matching
      const matchingAct = activities.find(
        (a) =>
          rawText.toLowerCase().includes(a.activity.code.toLowerCase()) ||
          (a.activity.equipment_tag && rawText.includes(a.activity.equipment_tag))
      );

      if (matchingAct) {
        const nowStr = new Date().toISOString();
        const newProgress = Math.min(
          100,
          (matchingAct.state?.current_progress_pct || 0) + (newObs[0].reported_progress || 100)
        );
        const newStatus = newProgress >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

        setActivities((prev) =>
          prev.map((a) => {
            if (a.activity.id === matchingAct.activity.id) {
              return {
                ...a,
                state: {
                  ...a.state!,
                  execution_status: newStatus,
                  actual_start_date: a.state?.actual_start_date || nowStr.slice(0, 10),
                  actual_finish_date: newStatus === 'COMPLETED' ? nowStr.slice(0, 10) : undefined,
                  current_progress_pct: newProgress,
                  updated_at: nowStr,
                },
              };
            }
            return a;
          })
        );

        // Record Audit
        const audit: AuditEvent = {
          id: generateUUIDv7(),
          project_id: activeProject.id,
          entity_type: 'ACTIVITY',
          entity_id: matchingAct.activity.id,
          action: 'AUTO_LINK_OBSERVATION',
          actor_id: user?.id || 'SYSTEM',
          actor_role: 'RUST_TRUST_PLANE',
          before_state: {
            progress_pct: matchingAct.state?.current_progress_pct,
            status: matchingAct.state?.execution_status,
          },
          after_state: { progress_pct: newProgress, status: newStatus },
          payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
          created_at: nowStr,
        };
        setAuditEvents((prev) => [audit, ...prev]);
      } else {
        // Add to Review Queue
        const newProposal: ReviewQueueItem = {
          proposal: {
            id: generateUUIDv7(),
            project_id: activeProject.id,
            observation_id: newObs[0].id,
            activity_id: activities[0]?.activity.id || 'd0000000-0000-0000-0000-000000000001',
            candidate_rank: 1,
            lexical_score: 0.65,
            semantic_score: 0.72,
            context_boost: 0.1,
            confidence_score: 0.74,
            match_tier: 'MEDIUM',
            explanation: 'Extracted fact matches WBS keywords. Needs Lead Planner review.',
            evidence_snippet: rawText.slice(0, 80),
            status: 'PENDING_REVIEW',
            created_at: new Date().toISOString(),
          },
          observation: newObs[0],
          activity: activities[0]?.activity,
        };
        setReviewQueue((prev) => [newProposal, ...prev]);
      }
    },
    [activities, activeProject.id, user?.id]
  );

  // Approve proposal handler
  const handleApproveProposal = useCallback(
    async (proposalId: string, comment?: string) => {
      const item = reviewQueue.find((q) => q.proposal.id === proposalId);
      const targetActivityId = item?.activity?.id || item?.proposal.activity_id;

      if (targetActivityId) {
        setActivities((prev) =>
          prev.map((a) => {
            if (a.activity.id === targetActivityId) {
              return {
                ...a,
                state: {
                  ...a.state!,
                  execution_status: 'COMPLETED',
                  actual_start_date: a.state?.actual_start_date || new Date().toISOString().slice(0, 10),
                  actual_finish_date: new Date().toISOString().slice(0, 10),
                  current_progress_pct: 100,
                  updated_at: new Date().toISOString(),
                },
              };
            }
            return a;
          })
        );
      }

      setReviewQueue((prev) => prev.filter((q) => q.proposal.id !== proposalId));

      // Record Audit
      const nowStr = new Date().toISOString();
      const prevAudit = auditEvents[0];
      const prevHash =
        prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const beforeState = { status: 'PENDING_REVIEW' };
      const afterState = { status: 'ACCEPTED', activity_id: targetActivityId, comment };

      const hash = await generateAuditPayloadHash(
        'MATCH_PROPOSAL',
        proposalId,
        'APPROVE_PROPOSAL',
        user?.id || '00000000-0000-0000-0000-000000000001',
        beforeState,
        afterState,
        nowStr,
        prevHash
      );

      const audit: AuditEvent = {
        id: generateUUIDv7(),
        project_id: activeProject.id,
        entity_type: 'MATCH_PROPOSAL',
        entity_id: proposalId,
        action: 'APPROVE_PROPOSAL',
        actor_id: user?.id || '00000000-0000-0000-0000-000000000001',
        actor_role: user?.role || 'LEAD_PLANNER',
        before_state: beforeState,
        after_state: afterState,
        payload_hash: hash,
        previous_hash: prevHash,
        created_at: nowStr,
      };
      setAuditEvents((prev) => [audit, ...prev]);
    },
    [reviewQueue, auditEvents, activeProject.id, user]
  );

  // Reject proposal handler
  const handleRejectProposal = useCallback(
    async (proposalId: string, reason?: string) => {
      setReviewQueue((prev) => prev.filter((q) => q.proposal.id !== proposalId));

      const nowStr = new Date().toISOString();
      const prevAudit = auditEvents[0];
      const prevHash =
        prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const beforeState = { status: 'PENDING_REVIEW' };
      const afterState = { status: 'REJECTED', reason };

      const hash = await generateAuditPayloadHash(
        'MATCH_PROPOSAL',
        proposalId,
        'REJECT_PROPOSAL',
        user?.id || '00000000-0000-0000-0000-000000000001',
        beforeState,
        afterState,
        nowStr,
        prevHash
      );

      const audit: AuditEvent = {
        id: generateUUIDv7(),
        project_id: activeProject.id,
        entity_type: 'MATCH_PROPOSAL',
        entity_id: proposalId,
        action: 'REJECT_PROPOSAL',
        actor_id: user?.id || '00000000-0000-0000-0000-000000000001',
        actor_role: user?.role || 'LEAD_PLANNER',
        before_state: beforeState,
        after_state: afterState,
        payload_hash: hash,
        previous_hash: prevHash,
        created_at: nowStr,
      };
      setAuditEvents((prev) => [audit, ...prev]);
    },
    [auditEvents, activeProject.id, user]
  );

  // Override proposal handler
  const handleOverrideProposal = useCallback(
    async (proposalId: string, newActivityId: string, comment?: string) => {
      setActivities((prev) =>
        prev.map((a) => {
          if (a.activity.id === newActivityId) {
            return {
              ...a,
              state: {
                ...a.state!,
                execution_status: 'IN_PROGRESS',
                actual_start_date: new Date().toISOString().slice(0, 10),
                current_progress_pct: Math.min(100, (a.state?.current_progress_pct || 0) + 50),
                updated_at: new Date().toISOString(),
              },
            };
          }
          return a;
        })
      );

      setReviewQueue((prev) => prev.filter((q) => q.proposal.id !== proposalId));

      const nowStr = new Date().toISOString();
      const prevAudit = auditEvents[0];
      const prevHash =
        prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const beforeState = { status: 'PENDING_REVIEW' };
      const afterState = { status: 'OVERRIDDEN', new_activity_id: newActivityId, comment };

      const hash = await generateAuditPayloadHash(
        'MATCH_PROPOSAL',
        proposalId,
        'OVERRIDE_MATCH_TARGET',
        user?.id || '00000000-0000-0000-0000-000000000001',
        beforeState,
        afterState,
        nowStr,
        prevHash
      );

      const audit: AuditEvent = {
        id: generateUUIDv7(),
        project_id: activeProject.id,
        entity_type: 'MATCH_PROPOSAL',
        entity_id: proposalId,
        action: 'OVERRIDE_MATCH_TARGET',
        actor_id: user?.id || '00000000-0000-0000-0000-000000000001',
        actor_role: user?.role || 'LEAD_PLANNER',
        before_state: beforeState,
        after_state: afterState,
        payload_hash: hash,
        previous_hash: prevHash,
        created_at: nowStr,
      };
      setAuditEvents((prev) => [audit, ...prev]);
    },
    [auditEvents, activeProject.id, user]
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
