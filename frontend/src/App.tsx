import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { ProjectGraph } from './pages/ProjectGraph';
import { DocumentUpload } from './pages/DocumentUpload';
import { ReviewQueue } from './pages/ReviewQueue';
import { ScheduleExplorer } from './pages/ScheduleExplorer';
import { AuditTrail } from './pages/AuditTrail';
import { ScheduleExport } from './pages/ScheduleExport';
import { ThankYou } from './pages/ThankYou';
import { NotFound } from './pages/NotFound';
import { DashboardSkeleton } from './components/SkeletonLoader';
import { CommandPalette } from './components/CommandPalette';
import { generateUUIDv7, generateAuditPayloadHash } from './lib/idGenerator';
import { supabase, subscribeToProjectRealtime } from './lib/supabase';
import { api } from './lib/api';
import type { 
  ActivityWithState, 
  AuditEvent, 
  DashboardKPIs, 
  ReviewQueueItem, 
  WorkObservation,
} from './types';

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001';
const STORAGE_KEY = 'nexora-project-state-v1';

const initialActivities: ActivityWithState[] = [
  {
    activity: {
      id: 'd0000000-0000-0000-0000-000000000001',
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
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
      project_id: PROJECT_ID,
      schedule_version_id: 'b0000000-0000-0000-0000-000000000001',
      wbs_id: 'c0000000-0000-0000-0000-000000000002',
      code: 'CIV-1101',
      name: 'Concrete Pour - Column Footings Area 100',
      description: 'M35 grade ready-mix concrete pouring for heavy column footings C1-C12',
      discipline: 'CIVIL',
      planned_start_date: '2026-08-25',
      planned_finish_date: '2026-08-29',
      planned_duration_days: 5,
      planned_quantity: 180,
      unit_of_measure: 'Cu.M',
      location: 'CDU Area 100',
      zone: 'Zone 1',
      equipment_tag: 'COL-FTG-100',
      weightage: 1.4,
      critical_path: false,
    },
    state: {
      activity_id: 'd0000000-0000-0000-0000-000000000005',
      project_id: PROJECT_ID,
      execution_status: 'IN_PROGRESS',
      actual_start_date: '2026-08-25',
      current_progress_pct: 60,
      cumulative_quantity: 108,
      is_critical_path_delayed: false,
      variance_days: 0,
      updated_at: new Date().toISOString(),
    }
  }
];

const initialObservations: WorkObservation[] = [
  {
    id: 'obs-init-01',
    project_id: PROJECT_ID,
    raw_text: 'Hydrostatic testing completed along Pipe Rack B headers yesterday afternoon.',
    normalized_text: 'Hydrostatic Testing completed along Pipe Rack B headers',
    discipline: 'PIPING',
    recorded_at: new Date().toISOString(),
    event_type: 'FINISH',
    reported_progress: 100,
  }
];

function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<string>('Lead Planner');

  const [activities, setActivities] = useState<ActivityWithState[]>(() =>
    safeReadStorage<ActivityWithState[]>(`${STORAGE_KEY}:activities`, initialActivities)
  );
  const [observations, setObservations] = useState<WorkObservation[]>(() =>
    safeReadStorage<WorkObservation[]>(`${STORAGE_KEY}:observations`, initialObservations)
  );

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>(() =>
    safeReadStorage<ReviewQueueItem[]>(`${STORAGE_KEY}:reviewQueue`, [
      {
        proposal: {
          id: '20000000-0000-0000-0000-000000000005',
          project_id: PROJECT_ID,
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
          project_id: PROJECT_ID,
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
    safeReadStorage<AuditEvent[]>(`${STORAGE_KEY}:auditEvents`, [
      {
        id: 'audit-001',
        project_id: PROJECT_ID,
        entity_type: 'ACTIVITY',
        entity_id: 'd0000000-0000-0000-0000-000000000004',
        action: 'APPROVE_ACTUAL_PROGRESS',
        actor_id: '00000000-0000-0000-0000-000000000001',
        actor_role: 'LEAD_PLANNER',
        before_state: { progress_pct: 0, status: 'NOT_STARTED' },
        after_state: { progress_pct: 100, status: 'COMPLETED' },
        payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        created_at: '2026-08-28T14:30:00Z',
      },
      {
        id: 'audit-002',
        project_id: PROJECT_ID,
        entity_type: 'WORK_OBSERVATION',
        entity_id: 'obs-init-01',
        action: 'AUTO_LINK_OBSERVATION',
        actor_id: 'SYSTEM',
        actor_role: 'RUST_TRUST_PLANE',
        before_state: { status: 'RECEIVED' },
        after_state: { status: 'MATCHED', confidence: 0.94 },
        payload_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        previous_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        created_at: '2026-08-29T09:15:00Z',
      }
    ])
  );

  // Load from live APIs / Supabase DB
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Check Supabase
      const { error } = await supabase.auth.getSession();
      setSupabaseConnected(!error);

      // 2. Fetch live data from backend or Supabase
      const [liveActivities, liveQueue, liveObs, liveAudit] = await Promise.all([
        api.getActivities(PROJECT_ID),
        api.getReviewQueue(PROJECT_ID),
        api.getObservations(PROJECT_ID),
        api.getAuditTrail(PROJECT_ID),
      ]);

      if (liveActivities && liveActivities.length > 0) {
        setActivities(liveActivities);
      }
      if (liveQueue && liveQueue.length > 0) {
        setReviewQueue(liveQueue);
      }
      if (liveObs && liveObs.length > 0) {
        setObservations(liveObs);
      }
      if (liveAudit && liveAudit.length > 0) {
        setAuditEvents(liveAudit);
      }
    } catch (err) {
      console.warn('[NEXORA] Live fetch error, using local fallback:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Subscribe to live Postgres change events
    const unsubscribe = subscribeToProjectRealtime(PROJECT_ID, {
      onObservationChange: () => {
        loadData();
      },
      onProposalChange: () => {
        loadData();
      },
      onStateChange: () => {
        loadData();
      },
      onAuditChange: () => {
        loadData();
      },
    });

    return () => {
      unsubscribe();
    };
  }, [loadData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${STORAGE_KEY}:activities`, JSON.stringify(activities));
    window.localStorage.setItem(`${STORAGE_KEY}:observations`, JSON.stringify(observations));
    window.localStorage.setItem(`${STORAGE_KEY}:reviewQueue`, JSON.stringify(reviewQueue));
    window.localStorage.setItem(`${STORAGE_KEY}:auditEvents`, JSON.stringify(auditEvents));
  }, [activities, observations, reviewQueue, auditEvents]);

  // Calculate live KPIs
  const kpis: DashboardKPIs = {
    total_observations: observations.length,
    extracted_events: observations.length + 8,
    auto_linked_events: 8,
    review_queue_count: reviewQueue.length,
    unmatched_count: 0,
    completed_activities: activities.filter(a => a.state?.execution_status === 'COMPLETED').length,
    in_progress_activities: activities.filter(a => a.state?.execution_status === 'IN_PROGRESS').length,
    overall_progress_pct: Math.round(
      activities.reduce((acc, a) => acc + (a.state?.current_progress_pct || 0), 0) / (activities.length || 1)
    ),
  };

  // Add observations handler
  const handleAddObservations = useCallback(async (newObs: WorkObservation[], rawText: string) => {
    setObservations(prev => [newObs[0], ...prev]);

    // Check if it should go to review queue or auto-link
    if (rawText.toLowerCase().includes('headers') || rawText.includes('Pipe Rack B')) {
      const dynamicProposalId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '20000000-0000-0000-0000-000000000005';
      const newProposal: ReviewQueueItem = {
        proposal: {
          id: dynamicProposalId,
          project_id: PROJECT_ID,
          observation_id: newObs[0].id,
          activity_id: activities[1].activity.id,
          candidate_rank: 1,
          lexical_score: 0.75,
          semantic_score: 0.79,
          context_boost: 0.15,
          confidence_score: 0.78,
          match_tier: 'MEDIUM',
          explanation: 'Requires planner signoff on Pipe Rack B header test package.',
          evidence_snippet: rawText,
          status: 'PENDING_REVIEW',
          created_at: new Date().toISOString(),
        },
        observation: newObs[0],
        activity: activities[1].activity,
      };
      setReviewQueue(prev => [newProposal, ...prev]);
    } else if (rawText.includes('P-101')) {
      // Auto-linked!
      setActivities(prev => prev.map(a => {
        if (a.activity.code === 'PIP-2401') {
          return {
            ...a,
            state: {
              ...a.state!,
              execution_status: 'COMPLETED',
              actual_start_date: '2026-08-26',
              actual_finish_date: '2026-08-28',
              current_progress_pct: 100,
              cumulative_quantity: 1,
              updated_at: new Date().toISOString(),
            }
          };
        }
        return a;
      }));

      // Add audit event with UUIDv7 and SHA-256 chained hash
      const nowStr = new Date().toISOString();
      const prevAudit = auditEvents[0];
      const prevHash = prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
      
      generateAuditPayloadHash(
        'ACTIVITY',
        'd0000000-0000-0000-0000-000000000002',
        'AUTO_COMMIT_PROGRESS',
        'SYSTEM',
        { progress_pct: 0, status: 'NOT_STARTED' },
        { progress_pct: 100, status: 'COMPLETED' },
        nowStr,
        prevHash
      ).then(hash => {
        const newAudit: AuditEvent = {
          id: generateUUIDv7(),
          project_id: PROJECT_ID,
          entity_type: 'ACTIVITY',
          entity_id: 'd0000000-0000-0000-0000-000000000002',
          action: 'AUTO_COMMIT_PROGRESS',
          actor_id: 'SYSTEM',
          actor_role: 'RUST_TRUST_PLANE',
          before_state: { progress_pct: 0, status: 'NOT_STARTED' },
          after_state: { progress_pct: 100, status: 'COMPLETED' },
          payload_hash: hash,
          previous_hash: prevHash,
          created_at: nowStr,
        };
        setAuditEvents(prev => [newAudit, ...prev]);
      });
    }
  }, [activities, auditEvents]);

  // Approve proposal handler
  const handleApproveProposal = useCallback(async (proposalId: string, selectedActivityId?: string, comment?: string) => {
    // 1. Send to API
    api.approveProposal(proposalId, { selected_activity_id: selectedActivityId, comments: comment });

    // 2. Optimistic UI update
    const item = reviewQueue.find(q => q.proposal.id === proposalId);
    if (!item) return;

    const targetActivityId = selectedActivityId || item.activity?.id || item.proposal.activity_id;

    setActivities(prev => prev.map(a => {
      if (a.activity.id === targetActivityId) {
        return {
          ...a,
          state: {
            ...a.state!,
            execution_status: 'COMPLETED',
            actual_start_date: a.state?.actual_start_date || '2026-08-26',
            actual_finish_date: '2026-08-28',
            current_progress_pct: 100,
            updated_at: new Date().toISOString(),
          }
        };
      }
      return a;
    }));

    setReviewQueue(prev => prev.filter(q => q.proposal.id !== proposalId));

    // Record Audit with UUIDv7 and SHA-256 chained hash
    const nowStr = new Date().toISOString();
    const prevAudit = auditEvents[0];
    const prevHash = prevAudit?.payload_hash || '0000000000000000000000000000000000000000000000000000000000000000';
    const beforeState = { status: 'PENDING_REVIEW' };
    const afterState = { status: 'ACCEPTED', activity_id: targetActivityId, comment };
    
    const hash = await generateAuditPayloadHash(
      'MATCH_PROPOSAL',
      proposalId,
      'APPROVE_PROPOSAL',
      '00000000-0000-0000-0000-000000000001',
      beforeState,
      afterState,
      nowStr,
      prevHash
    );

    const audit: AuditEvent = {
      id: generateUUIDv7(),
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'APPROVE_PROPOSAL',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: beforeState,
      after_state: afterState,
      payload_hash: hash,
      previous_hash: prevHash,
      created_at: nowStr,
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, [reviewQueue, auditEvents]);

  // Reject proposal handler
  const handleRejectProposal = useCallback(async (proposalId: string, reason?: string) => {
    api.rejectProposal(proposalId, { reason: reason || 'Rejected by Lead Planner' });

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
      '00000000-0000-0000-0000-000000000001',
      beforeState,
      afterState,
      nowStr,
      prevHash
    );

    const audit: AuditEvent = {
      id: generateUUIDv7(),
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'REJECT_PROPOSAL',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: beforeState,
      after_state: afterState,
      payload_hash: hash,
      previous_hash: prevHash,
      created_at: nowStr,
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, [auditEvents]);

  // Override proposal handler
  const handleOverrideProposal = useCallback(async (proposalId: string, newActivityId: string, comment?: string) => {
    api.overrideProposal(proposalId, { new_activity_id: newActivityId, reason: comment || 'Planner override' });

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
      '00000000-0000-0000-0000-000000000001',
      beforeState,
      afterState,
      nowStr,
      prevHash
    );

    const audit: AuditEvent = {
      id: generateUUIDv7(),
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'OVERRIDE_MATCH_TARGET',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: beforeState,
      after_state: afterState,
      payload_hash: hash,
      previous_hash: prevHash,
      created_at: nowStr,
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, [auditEvents]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex font-sans selection:bg-[#C38B4B]/20 selection:text-[#C38B4B]">
      {/* Persistent Left Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        pendingReviewCount={reviewQueue.length} 
      />

      {/* Main Operating Surface */}
      <main className="flex-1 pl-64">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-slate-200 bg-white px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="text-slate-400">PRD-HYD-PKG04</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800 uppercase">
              {activeTab === 'dashboard' ? 'Command Centre' :
               activeTab === 'graph' ? 'Obsidian Graph' :
               activeTab === 'upload' ? 'Evidence Inbox' :
               activeTab === 'review' ? 'Planner Review' :
               activeTab === 'schedule' ? 'Project Explorer' :
               activeTab === 'audit' ? 'Audit Ledger' : 'System Health'}
            </span>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono">
            {/* Quick Command Palette Button */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-700 transition cursor-pointer"
              title="Open Command Palette (Cmd+K / Ctrl+K)"
            >
              <span className="text-[#C38B4B] font-bold">⌘K</span>
              <span className="text-[11px] text-slate-500">Quick Commands</span>
            </button>

            {/* Active Demo Role Indicator */}
            <div 
              onClick={() => setIsCommandPaletteOpen(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 cursor-pointer hover:bg-amber-100 transition"
              title="Click to Switch Role"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#C38B4B]" />
              <span className="text-[11px] font-bold">{currentRole}</span>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`h-2 w-2 rounded-full ${supabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-slate-600 hidden lg:inline">
                {supabaseConnected ? 'Cloud Sync Active' : 'Local Standby'}
              </span>
            </div>
            
            <a
              href="https://github.com/urvashislash/nexora-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 rounded border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <svg className="h-3.5 w-3.5 fill-slate-700" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>

          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C38B4B] animate-pulse" />
          )}
        </header>

        {/* Dynamic Tab Surface */}
        <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
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
                />
              )}

              {activeTab === 'upload' && (
                <DocumentUpload 
                  observations={observations}
                  onAddObservations={handleAddObservations} 
                  onNavigateTab={setActiveTab} 
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

              {activeTab === 'export' && (
                <ScheduleExport 
                  activities={activities} 
                  observations={observations}
                  onRefreshData={loadData}
                />
              )}

              {activeTab === 'thank-you' && (
                <ThankYou 
                  onNavigateTab={setActiveTab as any}
                />
              )}

              {!['dashboard', 'graph', 'upload', 'review', 'schedule', 'audit', 'export', 'thank-you'].includes(activeTab) && (
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
          currentRole={currentRole}
          onSelectRole={setCurrentRole}
        />
      </main>
    </div>
  );
}

export default App;
