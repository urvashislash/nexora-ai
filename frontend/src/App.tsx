import { useEffect, useState, useCallback } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ProjectGraph } from './pages/ProjectGraph';
import { DocumentUpload } from './pages/DocumentUpload';
import { ReviewQueue } from './pages/ReviewQueue';
import { ScheduleExplorer } from './pages/ScheduleExplorer';
import { AuditTrail } from './pages/AuditTrail';
import { ScheduleExport } from './pages/ScheduleExport';
import { SystemHealth } from './pages/SystemHealth';
import { ThankYou } from './pages/ThankYou';
import { NotFound } from './pages/NotFound';
import { DashboardSkeleton } from './components/SkeletonLoader';
import { CommandPalette } from './components/CommandPalette';
import { AuthModal } from './components/AuthModal';
import { JwtInspectorModal } from './components/JwtInspectorModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import { ProjectSelector } from './components/ProjectSelector';
import { generateUUIDv7, generateAuditPayloadHash } from './lib/idGenerator';
import { Toaster } from './components/ui/sonner';
import { 
  supabase, 
  subscribeToProjectRealtime, 
  fetchProjects, 
  fetchProjectActivities, 
  fetchProjectObservations, 
  fetchProjectProposals, 
  fetchProjectAuditEvents,
  signOut
} from './lib/supabase';
import type { 
  ActivityWithState, 
  AuditEvent, 
  DashboardKPIs, 
  ReviewQueueItem, 
  WorkObservation,
  Project,
  AuthUser,
  UserRole
} from './types';

const STORAGE_KEY = 'nexora-project-state-v2';
type Theme = 'light' | 'dark';

const DEFAULT_PROJECTS: Project[] = [
  {
    id: 'a0000000-0000-0000-0000-000000000001',
    code: 'PRD-HYD-PKG04',
    name: 'Paradip-Hyderabad Refinery Expansion - Package 04',
    description: 'EPC-4 Package comprising Pipe Rack B, Compressor House Foundation, and Offsite Hydrocarbon Piping',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000002',
    code: 'MUM-METRO-04',
    name: 'Mumbai Metro Line 4 Underground Tunneling Package',
    description: 'Twin tunnel boring, underground station civil boxes, and 33kV traction substations',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
  },
  {
    id: 'a0000000-0000-0000-0000-000000000003',
    code: 'JAM-HYDRO-01',
    name: 'Jamnagar Refinery Hydrocracker Unit Expansion',
    description: 'Heavy hydrocracker reactor erection, alloy steel high pressure piping, and field DCS instrumentation',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
  }
];

const initialActivities: ActivityWithState[] = [
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000001',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000003',
      code: 'PIP-2400',
      name: 'Spool Erection and Alignment - Pipe Rack B',
      description: 'Prefabricated carbon steel piping spool erection on Rack B',
      discipline: 'PIPING',
      planned_start_date: '2026-08-10',
      planned_finish_date: '2026-08-25',
      planned_duration_days: 15,
      planned_quantity: 450,
      unit_of_measure: 'Inch-Dia',
      location: 'Pipe Rack B',
      zone: 'Zone 2',
      equipment_tag: 'RACK-B-CS',
      weightage: 1.5,
      critical_path: true,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000001',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'IN_PROGRESS',
      actual_start_date: '2026-08-10',
      actual_finish_date: undefined,
      current_progress_pct: 80,
      cumulative_quantity: 360,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  },
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000002',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000003',
      code: 'PIP-2401',
      name: 'Hydrostatic Testing - Line P-101 (Crude Feed Header)',
      description: 'Pressure testing of 24 inch crude feed header Line P-101 at 42.5 bar',
      discipline: 'PIPING',
      planned_start_date: '2026-08-26',
      planned_finish_date: '2026-08-28',
      planned_duration_days: 3,
      planned_quantity: 1,
      unit_of_measure: 'Test-Pack',
      location: 'Pipe Rack B',
      zone: 'Zone 2',
      equipment_tag: 'LINE-P-101',
      weightage: 2.0,
      critical_path: true,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000002',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'NOT_STARTED',
      actual_start_date: undefined,
      actual_finish_date: undefined,
      current_progress_pct: 0,
      cumulative_quantity: 0,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  },
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000003',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000003',
      code: 'PIP-2402',
      name: 'Hydrostatic Testing - Line P-102 (Naphtha Return Header)',
      description: 'Pressure testing of 16 inch naphtha return header Line P-102 at 32.0 bar',
      discipline: 'PIPING',
      planned_start_date: '2026-08-28',
      planned_finish_date: '2026-08-30',
      planned_duration_days: 3,
      planned_quantity: 1,
      unit_of_measure: 'Test-Pack',
      location: 'Pipe Rack B',
      zone: 'Zone 2',
      equipment_tag: 'LINE-P-102',
      weightage: 1.8,
      critical_path: false,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000003',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'NOT_STARTED',
      current_progress_pct: 0,
      cumulative_quantity: 0,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  },
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000004',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000004',
      code: 'CIV-1100',
      name: 'Rebar Tying and Shuttering - Compressor Foundation',
      description: 'Reinforcement steel bar cutting, bending, binding, and formwork for C-101',
      discipline: 'CIVIL',
      planned_start_date: '2026-08-15',
      planned_finish_date: '2026-08-24',
      planned_duration_days: 10,
      planned_quantity: 35.5,
      unit_of_measure: 'MT',
      location: 'Compressor House',
      zone: 'Zone 1',
      equipment_tag: 'FND-C-101',
      weightage: 1.2,
      critical_path: false,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000004',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'COMPLETED',
      actual_start_date: '2026-08-15',
      actual_finish_date: '2026-08-24',
      current_progress_pct: 100,
      cumulative_quantity: 35.5,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  },
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000005',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000004',
      code: 'CIV-1101',
      name: 'Concrete Pouring (M35 Grade) - Compressor Foundation C-101',
      description: 'Mass concrete pouring of 120 cum M35 grade concrete with temperature monitoring',
      discipline: 'CIVIL',
      planned_start_date: '2026-08-25',
      planned_finish_date: '2026-08-27',
      planned_duration_days: 3,
      planned_quantity: 120,
      unit_of_measure: 'Cum',
      location: 'Compressor House',
      zone: 'Zone 1',
      equipment_tag: 'FND-C-101',
      weightage: 2.2,
      critical_path: false,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000005',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'IN_PROGRESS',
      actual_start_date: '2026-08-25',
      actual_finish_date: undefined,
      current_progress_pct: 50,
      cumulative_quantity: 60,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  },
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000006',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000005',
      code: 'ELE-3100',
      name: 'Cable Tray Installation - Substation 4 to Pipe Rack B',
      discipline: 'ELECTRICAL',
      planned_start_date: '2026-08-20',
      planned_finish_date: '2026-09-02',
      planned_duration_days: 14,
      planned_quantity: 800,
      unit_of_measure: 'Rmt',
      location: 'Substation 4',
      zone: 'Zone 3',
      equipment_tag: 'TRAY-SS4-RB',
      weightage: 1.0,
      critical_path: false,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000006',
      project_id: 'a0000000-0000-0000-0000-000000000001',
      execution_status: 'IN_PROGRESS',
      actual_start_date: '2026-08-20',
      actual_finish_date: undefined,
      current_progress_pct: 35,
      cumulative_quantity: 280,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  }
];

function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isJwtModalOpen, setIsJwtModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    safeReadStorage<Theme>(
      `${STORAGE_KEY}:theme`,
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    )
  );
  
  // User Authentication & Role State
  const [user, setUser] = useState<AuthUser | null>(() => 
    safeReadStorage<AuthUser | null>(`${STORAGE_KEY}:user`, {
      id: 'usr-planner-001',
      email: 'planner@nexora.ai',
      full_name: 'Vikram Singh (Lead Planner)',
      role: 'PLANNER',
    })
  );
  const [jwtToken, setJwtToken] = useState<string | null>(() =>
    safeReadStorage<string | null>(`${STORAGE_KEY}:jwt`, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdHhnc2hyanB5dmN6aWR6dnRvIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJ1c3ItcGxhbm5lci0wMDEiLCJlbWFpbCI6InBsYW5uZXJAbmV4b3JhLmFpIiwiZXhwIjoyMTAzNjU2NzY3LCJpYXQiOjE3ODgwODA3NjcsInVzZXJfbWV0YWRhdGEiOnsiZnVsbF9uYW1lIjoiVmlrcmFtIFNpbmdoIiwicm9sZSI6IlBMQU5ORVIifX0.mock_signature_valid')
  );
  const [currentRole, setCurrentRole] = useState<UserRole>('PLANNER');

  // Multi-Project State
  const [projectsList, setProjectsList] = useState<Project[]>(() =>
    safeReadStorage<Project[]>(`${STORAGE_KEY}:projects`, DEFAULT_PROJECTS)
  );
  const [activeProject, setActiveProject] = useState<Project>(() =>
    safeReadStorage<Project>(`${STORAGE_KEY}:activeProject`, DEFAULT_PROJECTS[0])
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);

  // Entities state
  const [activities, setActivities] = useState<ActivityWithState[]>(() =>
    safeReadStorage<ActivityWithState[]>(`${STORAGE_KEY}:${activeProject.id}:activities`, initialActivities)
  );

  const [observations, setObservations] = useState<WorkObservation[]>(() =>
    safeReadStorage<WorkObservation[]>(`${STORAGE_KEY}:${activeProject.id}:observations`, [
      {
        id: 'obs-001',
        project_id: activeProject.id,
        raw_text: 'Spool erection on Pipe Rack B Tier 2 completed with alignment check and bolt torque tightening done.',
        normalized_text: 'Spool Erection on Pipe Rack B Tier 2 completed',
        discipline: 'PIPING',
        location: 'Pipe Rack B',
        zone: 'Zone 2',
        equipment_tag: 'RACK-B-CS',
        recorded_at: '2026-08-25T11:30:00Z',
        event_type: 'PROGRESS',
        reported_progress: 80,
      }
    ])
  );

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() =>
    safeReadStorage<ReviewQueueItem[]>(`${STORAGE_KEY}:${activeProject.id}:reviewQueue`, [
      {
        proposal: {
          id: '20000000-0000-0000-0000-000000000005',
          project_id: activeProject.id,
          observation_id: '10000000-0000-0000-0000-000000000005',
          activity_id: 'd0000000-0000-0000-0000-000000000002',
          candidate_rank: 1,
          lexical_score: 0.72,
          semantic_score: 0.78,
          context_boost: 0.15,
          confidence_score: 0.76,
          match_tier: 'MEDIUM',
          explanation: 'Confidence 76.0%: Matches both PIP-2401 and PIP-2402 on Pipe Rack B header',
          evidence_snippet: 'Obs: "Hydrostatic testing completed along Pipe Rack B headers" -> PIP-2401',
          status: 'PENDING_REVIEW',
          created_at: new Date().toISOString(),
        },
        observation: {
          id: '10000000-0000-0000-0000-000000000005',
          project_id: activeProject.id,
          raw_text: 'Hydrostatic testing completed along Pipe Rack B headers yesterday afternoon.',
          normalized_text: 'Hydrostatic Testing completed along Pipe Rack B headers',
          discipline: 'PIPING',
          recorded_at: new Date().toISOString(),
          event_type: 'FINISH',
        },
        activity: initialActivities[1].activity,
      }
    ])
  );

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() =>
    safeReadStorage<AuditEvent[]>(`${STORAGE_KEY}:${activeProject.id}:auditEvents`, [
      {
        id: 'audit-001',
        project_id: activeProject.id,
        entity_type: 'ACTIVITY',
        entity_id: 'd0000000-0000-0000-0000-000000000004',
        action: 'APPROVE_ACTUAL_PROGRESS',
        actor_id: user?.id || '00000000-0000-0000-0000-000000000001',
        actor_role: 'LEAD_PLANNER',
        before_state: { progress_pct: 0, status: 'NOT_STARTED' },
        after_state: { progress_pct: 100, status: 'COMPLETED' },
        payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        created_at: '2026-08-28T14:30:00Z',
      }
    ])
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
          DEFAULT_PROJECTS.forEach(dp => {
            if (!combined.some(p => p.id === dp.id || p.code === dp.code)) {
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
        const queueItems: ReviewQueueItem[] = liveProposals.map(p => ({
          proposal: p,
          observation: liveObs?.find(o => o.id === p.observation_id),
          activity: liveActs?.find(a => a.activity.id === p.activity_id)?.activity,
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
    localStorage.setItem(`${STORAGE_KEY}:user`, JSON.stringify(user));
    localStorage.setItem(`${STORAGE_KEY}:jwt`, JSON.stringify(jwtToken));
    localStorage.setItem(`${STORAGE_KEY}:activeProject`, JSON.stringify(activeProject));
    localStorage.setItem(`${STORAGE_KEY}:projects`, JSON.stringify(projectsList));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:activities`, JSON.stringify(activities));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:observations`, JSON.stringify(observations));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:reviewQueue`, JSON.stringify(reviewQueue));
    localStorage.setItem(`${STORAGE_KEY}:${activeProject.id}:auditEvents`, JSON.stringify(auditEvents));
  }, [user, jwtToken, activeProject, projectsList, activities, observations, reviewQueue, auditEvents]);

  // Handle Project Selection
  const handleSelectProject = (project: Project) => {
    setActiveProject(project);
    setIsLoading(true);
  };

  // Handle Project Created
  const handleProjectCreated = (newProject: Project) => {
    setProjectsList(prev => [newProject, ...prev]);
    setActiveProject(newProject);
    setIsLoading(true);
  };

  // Handle Auth Success
  const handleAuthSuccess = (authUser: AuthUser, token?: string) => {
    setUser(authUser);
    if (token) setJwtToken(token);
    setCurrentRole(authUser.role);
  };

  // Handle Logout
  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setJwtToken(null);
  };

  // KPI Calculations
  const completedCount = activities.filter(a => a.state?.execution_status === 'COMPLETED').length;
  const inProgressCount = activities.filter(a => a.state?.execution_status === 'IN_PROGRESS').length;
  const totalWeight = activities.reduce((acc, a) => acc + (a.activity.weightage || 1), 0);
  const weightedProgress = activities.reduce((acc, a) => {
    const progress = a.state?.current_progress_pct || 0;
    const weight = a.activity.weightage || 1;
    return acc + (progress * weight);
  }, 0);
  const overallProgressPct = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;

  const kpis: DashboardKPIs = {
    total_observations: observations.length,
    extracted_events: observations.length,
    auto_linked_events: activities.filter(a => (a.state?.current_progress_pct || 0) > 0).length,
    review_queue_count: reviewQueue.length,
    unmatched_count: 0,
    completed_activities: completedCount,
    in_progress_activities: inProgressCount,
    overall_progress_pct: overallProgressPct,
  };

  // Add observation handler
  const handleAddObservations = useCallback((newObs: WorkObservation[], rawText: string) => {
    setObservations(prev => [newObs[0], ...prev]);

    // Fast-path auto matching
    const matchingAct = activities.find(a => 
      rawText.toLowerCase().includes(a.activity.code.toLowerCase()) || 
      (a.activity.equipment_tag && rawText.includes(a.activity.equipment_tag))
    );

    if (matchingAct) {
      const nowStr = new Date().toISOString();
      const newProgress = Math.min(100, (matchingAct.state?.current_progress_pct || 0) + (newObs[0].reported_progress || 100));
      const newStatus = newProgress >= 100 ? 'COMPLETED' : 'IN_PROGRESS';

      setActivities(prev => prev.map(a => {
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
            }
          };
        }
        return a;
      }));

      // Record Audit
      const audit: AuditEvent = {
        id: generateUUIDv7(),
        project_id: activeProject.id,
        entity_type: 'ACTIVITY',
        entity_id: matchingAct.activity.id,
        action: 'AUTO_LINK_OBSERVATION',
        actor_id: user?.id || 'SYSTEM',
        actor_role: 'RUST_TRUST_PLANE',
        before_state: { progress_pct: matchingAct.state?.current_progress_pct, status: matchingAct.state?.execution_status },
        after_state: { progress_pct: newProgress, status: newStatus },
        payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        created_at: nowStr,
      };
      setAuditEvents(prev => [audit, ...prev]);
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
          context_boost: 0.10,
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
      setReviewQueue(prev => [newProposal, ...prev]);
    }
  }, [activities, activeProject.id, user?.id]);

  // Approve proposal handler
  const handleApproveProposal = useCallback(async (proposalId: string, comment?: string) => {
    const item = reviewQueue.find(q => q.proposal.id === proposalId);
    const targetActivityId = item?.activity?.id || item?.proposal.activity_id;

    if (targetActivityId) {
      setActivities(prev => prev.map(a => {
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
            }
          };
        }
        return a;
      }));
    }

    setReviewQueue(prev => prev.filter(q => q.proposal.id !== proposalId));

    // Record Audit
    const nowStr = new Date().toISOString();
    const prevAudit = auditEvents[0];
    const prevHash = prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
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
    setAuditEvents(prev => [audit, ...prev]);
  }, [reviewQueue, auditEvents, activeProject.id, user]);

  // Reject proposal handler
  const handleRejectProposal = useCallback(async (proposalId: string, reason?: string) => {
    setReviewQueue(prev => prev.filter(q => q.proposal.id !== proposalId));

    const nowStr = new Date().toISOString();
    const prevAudit = auditEvents[0];
    const prevHash = prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
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
    setAuditEvents(prev => [audit, ...prev]);
  }, [auditEvents, activeProject.id, user]);

  // Override proposal handler
  const handleOverrideProposal = useCallback(async (proposalId: string, newActivityId: string, comment?: string) => {
    setActivities(prev => prev.map(a => {
      if (a.activity.id === newActivityId) {
        return {
          ...a,
          state: {
            ...a.state!,
            execution_status: 'IN_PROGRESS',
            actual_start_date: new Date().toISOString().slice(0, 10),
            current_progress_pct: Math.min(100, (a.state?.current_progress_pct || 0) + 50),
            updated_at: new Date().toISOString(),
          }
        };
      }
      return a;
    }));

    setReviewQueue(prev => prev.filter(q => q.proposal.id !== proposalId));

    const nowStr = new Date().toISOString();
    const prevAudit = auditEvents[0];
    const prevHash = prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
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
    setAuditEvents(prev => [audit, ...prev]);
  }, [auditEvents, activeProject.id, user]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}:theme`, theme);
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0F172A' : '#F5F6F8');
  }, [theme]);

  return (
    <div className={`${theme === 'dark' ? 'dark bg-slate-950' : 'bg-[#F5F6F8]'} flex min-h-screen text-slate-900 font-sans selection:bg-[#C38B4B]/20 selection:text-[#C38B4B]`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
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
        activeProject={activeProject}
        user={user}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenJwt={() => setIsJwtModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Operating Surface */}
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 lg:pl-64">
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
            {/* Global Project Switcher Dropdown */}
            <ProjectSelector
              projects={projectsList}
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onOpenCreateProject={() => setIsCreateProjectModalOpen(true)}
            />
            <span className="hidden text-slate-300 font-normal sm:inline">/</span>
            <span className="hidden font-semibold text-slate-800 tracking-tight sm:inline">
              {activeTab === 'dashboard' ? 'Overview' :
               activeTab === 'graph' ? 'Dependencies' :
               activeTab === 'upload' ? 'Evidence' :
               activeTab === 'review' ? 'Planner Review' :
               activeTab === 'schedule' ? 'Schedule' :
               activeTab === 'audit' ? 'Audit Ledger' :
               activeTab === 'health' ? 'System Health' :
               activeTab === 'export' ? 'Exports' : 'Overview'}
            </span>
          </div>

          <div className="flex shrink-0 items-center space-x-2 sm:space-x-3 text-xs font-sans">
            {/* Quick Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200/90 rounded-lg text-slate-700 transition-all duration-150 cursor-pointer active:scale-[0.98]"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <kbd className="px-1.5 py-0.5 rounded bg-white text-[10px] font-semibold text-slate-700 shadow-2xs border border-slate-200/60 font-sans">⌘K</kbd>
              <span className="text-[11px] font-medium text-slate-600">Quick Commands</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
              className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Active User Role Indicator / JWT Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsJwtModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700 transition-all duration-150 hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              title="Inspect cryptographic JWT token"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C38B4B]" />
              <span className="text-[11px] font-medium tracking-tight">{user?.role ? user.role.replace(/_/g, ' ') : currentRole.replace(/_/g, ' ')}</span>
            </button>

            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-500 font-sans">
              <span className={`h-1.5 w-1.5 rounded-full ${supabaseConnected ? 'bg-[#34C759]' : 'bg-[#FF9500]'}`} />
              <span className="text-slate-600 hidden lg:inline font-normal text-[11px]">
                {supabaseConnected ? 'Cloud Sync Active' : 'Local Standby'}
              </span>
            </div>
          </div>

          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C38B4B] animate-pulse" />
          )}
        </header>

        {/* Dynamic Tab Surface */}
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
          {isLoading && activities.length === 0 ? (
            <DashboardSkeleton />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  kpis={kpis} 
                  activities={activities} 
                  onNavigateTab={setActiveTab} 
                />
              )}

              {activeTab === 'graph' && (
                <ProjectGraph 
                  activities={activities} 
                  observations={observations}
                  project={activeProject}
                />
              )}

              {activeTab === 'upload' && (
                <DocumentUpload 
                  observations={observations}
                  onAddObservations={handleAddObservations} 
                  onNavigateTab={setActiveTab} 
                  projectId={activeProject.id}
                />
              )}

              {activeTab === 'review' && (
                <ReviewQueue 
                  items={reviewQueue} 
                  activities={activities.map(a => a.activity)} 
                  onApprove={handleApproveProposal} 
                  onReject={handleRejectProposal} 
                  onOverride={handleOverrideProposal} 
                />
              )}

              {activeTab === 'schedule' && (
                <ScheduleExplorer 
                  activities={activities} 
                />
              )}

              {activeTab === 'audit' && (
                <AuditTrail 
                  events={auditEvents} 
                />
              )}

              {activeTab === 'health' && (
                <SystemHealth />
              )}

              {activeTab === 'export' && (
                <ScheduleExport 
                  activities={activities} 
                  observations={observations}
                  onRefreshData={() => loadData(activeProject.id)}
                  activeProject={activeProject}
                />
              )}

              {activeTab === 'thank-you' && (
                <ThankYou 
                  onNavigateTab={setActiveTab as any}
                />
              )}

              {!['dashboard', 'graph', 'upload', 'review', 'schedule', 'audit', 'health', 'export', 'thank-you'].includes(activeTab) && (
                <NotFound 
                  onNavigateHome={() => setActiveTab('dashboard')}
                />
              )}
            </>
          )}
        </div>

        {/* Global Command Palette Modal */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onNavigateTab={setActiveTab}
          activities={activities}
          currentRole={user?.role || currentRole}
          onSelectRole={(r: string) => {
            const role = r as UserRole;
            setCurrentRole(role);
            if (user) {
              setUser({ ...user, role });
            }
          }}
        />

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />

        {/* JWT Inspector Modal */}
        <JwtInspectorModal
          isOpen={isJwtModalOpen}
          onClose={() => setIsJwtModalOpen(false)}
          token={jwtToken}
          user={user}
        />

        {/* Create Project Modal Wizard */}
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          onProjectCreated={handleProjectCreated}
          userId={user?.id}
        />

        {/* Global Toast Notifications */}
        <Toaster position="top-right" richColors />
      </main>
    </div>
  );
}

export default App;
