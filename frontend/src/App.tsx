import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { DocumentUpload } from './pages/DocumentUpload';
import { ReviewQueue } from './pages/ReviewQueue';
import { ScheduleExplorer } from './pages/ScheduleExplorer';
import { AuditTrail } from './pages/AuditTrail';
import { ScheduleExport } from './pages/ScheduleExport';
import { supabase } from './lib/supabase';
import { api } from './lib/api';
import type { 
  ActivityWithState, 
  AuditEvent, 
  DashboardKPIs, 
  ReviewQueueItem, 
  WorkObservation,
} from './types';

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initial Demo Activities
  const [activities, setActivities] = useState<ActivityWithState[]>([
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
  ]);

  const [observations, setObservations] = useState<WorkObservation[]>([
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
  ]);

  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([
    {
      proposal: {
        id: 'prop-init-01',
        project_id: PROJECT_ID,
        observation_id: 'obs-init-01',
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
        id: 'obs-init-01',
        project_id: PROJECT_ID,
        raw_text: 'Hydrostatic testing completed along Pipe Rack B headers yesterday afternoon.',
        normalized_text: 'Hydrostatic Testing completed along Pipe Rack B headers',
        discipline: 'PIPING',
        recorded_at: new Date().toISOString(),
        event_type: 'FINISH',
      },
      activity: activities[1].activity,
    }
  ]);

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([
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
  ]);

  // Initial Load from Live APIs
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Check Supabase
        const { error } = await supabase.auth.getSession();
        if (mounted) setSupabaseConnected(!error);

        // 2. Fetch live data from backend or Supabase
        const [liveActivities, liveQueue, liveObs, liveAudit] = await Promise.all([
          api.getActivities(PROJECT_ID),
          api.getReviewQueue(PROJECT_ID),
          api.getObservations(PROJECT_ID),
          api.getAuditTrail(PROJECT_ID),
        ]);

        if (mounted) {
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
        }
      } catch (err) {
        console.warn('[NEXORA] Live fetch error, using local fallback:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

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
      const newProposal: ReviewQueueItem = {
        proposal: {
          id: `prop-${Date.now()}`,
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

      // Add audit event
      const newAudit: AuditEvent = {
        id: `audit-${Date.now()}`,
        project_id: PROJECT_ID,
        entity_type: 'ACTIVITY',
        entity_id: 'd0000000-0000-0000-0000-000000000002',
        action: 'AUTO_COMMIT_PROGRESS',
        actor_id: 'SYSTEM',
        actor_role: 'RUST_TRUST_PLANE',
        before_state: { progress_pct: 0, status: 'NOT_STARTED' },
        after_state: { progress_pct: 100, status: 'COMPLETED' },
        payload_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        created_at: new Date().toISOString(),
      };
      setAuditEvents(prev => [newAudit, ...prev]);
    }
  }, [activities]);

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

    // Record Audit
    const audit: AuditEvent = {
      id: `audit-${Date.now()}`,
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'APPROVE_PROPOSAL',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: { status: 'PENDING_REVIEW' },
      after_state: { status: 'ACCEPTED', activity_id: targetActivityId, comment },
      payload_hash: 'c3f2e1d0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2',
      created_at: new Date().toISOString(),
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, [reviewQueue]);

  // Reject proposal handler
  const handleRejectProposal = useCallback(async (proposalId: string, reason?: string) => {
    api.rejectProposal(proposalId, { reason: reason || 'Rejected by Lead Planner' });

    setReviewQueue(prev => prev.filter(q => q.proposal.id !== proposalId));

    const audit: AuditEvent = {
      id: `audit-${Date.now()}`,
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'REJECT_PROPOSAL',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: { status: 'PENDING_REVIEW' },
      after_state: { status: 'REJECTED', reason },
      payload_hash: 'e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3',
      created_at: new Date().toISOString(),
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, []);

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

    const audit: AuditEvent = {
      id: `audit-${Date.now()}`,
      project_id: PROJECT_ID,
      entity_type: 'MATCH_PROPOSAL',
      entity_id: proposalId,
      action: 'OVERRIDE_MATCH_TARGET',
      actor_id: '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: { status: 'PENDING_REVIEW' },
      after_state: { status: 'OVERRIDDEN', new_activity_id: newActivityId, comment },
      payload_hash: 'f5e4d3c2b1a0987654321fedcba0987654321fedcba0987654321fedcba09876',
      created_at: new Date().toISOString(),
    };
    setAuditEvents(prev => [audit, ...prev]);
  }, []);

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
               activeTab === 'upload' ? 'Evidence Inbox' :
               activeTab === 'review' ? 'Planner Review' :
               activeTab === 'schedule' ? 'Project Explorer' :
               activeTab === 'audit' ? 'Audit Ledger' : 'System Health'}
            </span>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className={`h-2 w-2 rounded-full ${supabaseConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-slate-600">
                {supabaseConnected ? 'Cloud Sync Active' : 'Local Standby'}
              </span>
            </div>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Refinery Expansion Package 04</span>
          </div>

          {isLoading && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C38B4B] animate-pulse" />
          )}
        </header>

        {/* Dynamic Tab Surface */}
        <div className="max-w-7xl mx-auto px-8 pt-8 pb-12">
          {activeTab === 'dashboard' && (
            <Dashboard 
              kpis={kpis} 
              activities={activities} 
              onNavigateTab={setActiveTab} 
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
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
