import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { DocumentUpload } from './pages/DocumentUpload';
import { ReviewQueue } from './pages/ReviewQueue';
import { ScheduleExplorer } from './pages/ScheduleExplorer';
import { AuditTrail } from './pages/AuditTrail';
import { ScheduleExport } from './pages/ScheduleExport';
import type { 
  ActivityWithState, 
  AuditEvent, 
  DashboardKPIs, 
  ReviewQueueItem, 
  WorkObservation,
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Initial Demo Activities
  const [activities, setActivities] = useState<ActivityWithState[]>([
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
        activity_id: 'd0000000-0000-0000-0000-000000000002',
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
        project_id: 'a0000000-0000-0000-0000-000000000001',
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

  const [observations, setObservations] = useState<WorkObservation[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([
    {
      proposal: {
        id: 'prop-init-01',
        project_id: 'a0000000-0000-0000-0000-000000000001',
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
        project_id: 'a0000000-0000-0000-0000-000000000001',
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
      project_id: 'a0000000-0000-0000-0000-000000000001',
      entity_type: 'ACTUAL_EVENT',
      entity_id: 'd0000000-0000-0000-0000-000000000004',
      action: 'SYSTEM_VERIFIED_AUTO_LINK',
      actor_role: 'RUST_TRUST_ENGINE',
      payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      before_state: { status: 'NOT_STARTED', progress: 0 },
      after_state: { status: 'COMPLETED', progress: 100, finish_date: '2026-08-24' },
      created_at: '2026-08-29T12:00:00.000Z',
    }
  ]);

  // Handle new observations added from Upload page
  const handleAddObservations = (newObs: WorkObservation[], rawText: string) => {
    setObservations(prev => [...prev, ...newObs]);

    // Check for Scenario E (Invalid Date Sequence)
    if (rawText.toLowerCase().includes('finished on 20-aug') && rawText.toLowerCase().includes('started on 28-aug')) {
      alert("❌ [RUST TRUST LAYER REJECTION]: Validation Error — Finish Date (20-Aug-2026) cannot be before Start Date (28-Aug-2026). Event rejected.");
      return;
    }

    // Check for Scenario A (Exact Match -> Auto-Link)
    if (rawText.toLowerCase().includes('p-101') || rawText.toLowerCase().includes('pip-2401')) {
      const targetActId = 'd0000000-0000-0000-0000-000000000002';
      
      // Update PIP-2401 state to Completed (100%)
      setActivities(prev => prev.map(item => {
        if (item.activity.id === targetActId) {
          return {
            ...item,
            state: {
              ...item.state!,
              execution_status: 'COMPLETED',
              actual_start_date: '2026-08-26',
              actual_finish_date: '2026-08-28',
              current_progress_pct: 100,
              cumulative_quantity: 1,
              updated_at: new Date().toISOString(),
            }
          };
        }
        return item;
      }));

      // Add Audit record
      const newAudit: AuditEvent = {
        id: `audit-${Date.now()}`,
        project_id: 'a0000000-0000-0000-0000-000000000001',
        entity_type: 'ACTUAL_EVENT',
        entity_id: targetActId,
        action: 'SYSTEM_VERIFIED_AUTO_LINK',
        actor_role: 'RUST_TRUST_LAYER',
        payload_hash: Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(''),
        before_state: { execution_status: 'NOT_STARTED', current_progress_pct: 0 },
        after_state: { execution_status: 'COMPLETED', current_progress_pct: 100, actual_finish_date: '2026-08-28' },
        created_at: new Date().toISOString(),
      };
      setAuditEvents(prev => [newAudit, ...prev]);
    }
    // Check for Scenario B (Semantic Match -> PIP-2400)
    else if (rawText.toLowerCase().includes('spool erection')) {
      const targetActId = 'd0000000-0000-0000-0000-000000000001';
      setActivities(prev => prev.map(item => {
        if (item.activity.id === targetActId) {
          return {
            ...item,
            state: {
              ...item.state!,
              execution_status: 'COMPLETED',
              actual_finish_date: '2026-08-25',
              current_progress_pct: 100,
              cumulative_quantity: 450,
              updated_at: new Date().toISOString(),
            }
          };
        }
        return item;
      }));

      const newAudit: AuditEvent = {
        id: `audit-${Date.now()}`,
        project_id: 'a0000000-0000-0000-0000-000000000001',
        entity_type: 'ACTUAL_EVENT',
        entity_id: targetActId,
        action: 'SEMANTIC_MATCH_AUTO_LINK',
        actor_role: 'RUST_TRUST_LAYER',
        payload_hash: Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(''),
        before_state: { execution_status: 'IN_PROGRESS', current_progress_pct: 80 },
        after_state: { execution_status: 'COMPLETED', current_progress_pct: 100, actual_finish_date: '2026-08-25' },
        created_at: new Date().toISOString(),
      };
      setAuditEvents(prev => [newAudit, ...prev]);
    }
    // Scenario C: Ambiguous -> Route to Planner Review Queue
    else if (rawText.toLowerCase().includes('headers') || rawText.toLowerCase().includes('pressure testing')) {
      const newProposal: ReviewQueueItem = {
        proposal: {
          id: `prop-${Date.now()}`,
          project_id: 'a0000000-0000-0000-0000-000000000001',
          observation_id: newObs[0]?.id || `obs-${Date.now()}`,
          activity_id: 'd0000000-0000-0000-0000-000000000003',
          candidate_rank: 1,
          lexical_score: 0.70,
          semantic_score: 0.75,
          context_boost: 0.15,
          confidence_score: 0.74,
          match_tier: 'MEDIUM',
          explanation: 'Ambiguous match between PIP-2401 and PIP-2402 -> Routed to Planner Review',
          status: 'PENDING_REVIEW',
          created_at: new Date().toISOString(),
        },
        observation: newObs[0],
        activity: activities[2].activity,
      };
      setReviewQueue(prev => [newProposal, ...prev]);
    }
  };

  // Handle Planner Review Approval
  const handleApproveProposal = (proposalId: string, selectedActivityId?: string) => {
    const item = reviewQueue.find(i => i.proposal.id === proposalId);
    if (!item) return;

    const targetActivityId = selectedActivityId || item.proposal.activity_id;

    // Update activity state
    setActivities(prev => prev.map(a => {
      if (a.activity.id === targetActivityId) {
        return {
          ...a,
          state: {
            ...a.state!,
            execution_status: 'COMPLETED',
            actual_start_date: a.state?.actual_start_date || '2026-08-28',
            actual_finish_date: '2026-08-30',
            current_progress_pct: 100,
            updated_at: new Date().toISOString(),
          }
        };
      }
      return a;
    }));

    // Add Audit Record
    const newAudit: AuditEvent = {
      id: `audit-${Date.now()}`,
      project_id: 'a0000000-0000-0000-0000-000000000001',
      entity_type: 'PLANNER_APPROVAL',
      entity_id: targetActivityId,
      action: 'HUMAN_VERIFIED_COMMIT',
      actor_role: 'PLANNER (Rajesh Sharma)',
      payload_hash: Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(''),
      before_state: { status: 'PENDING_REVIEW' },
      after_state: { status: 'COMMITTED', verification: 'HUMAN_VERIFIED', activity_id: targetActivityId },
      created_at: new Date().toISOString(),
    };
    setAuditEvents(prev => [newAudit, ...prev]);

    // Remove from Review Queue
    setReviewQueue(prev => prev.filter(i => i.proposal.id !== proposalId));
  };

  const handleRejectProposal = (proposalId: string, _reason?: string) => {
    setReviewQueue(prev => prev.filter(i => i.proposal.id !== proposalId));
  };

  // Calculate live KPIs
  const completedCount = activities.filter(a => a.state?.execution_status === 'COMPLETED').length;
  const inProgressCount = activities.filter(a => a.state?.execution_status === 'IN_PROGRESS').length;
  const totalProgress = activities.reduce((acc, a) => acc + (a.state?.current_progress_pct || 0), 0);
  const overallProgressPct = parseFloat((totalProgress / activities.length).toFixed(1));

  const kpis: DashboardKPIs = {
    total_observations: observations.length + 3,
    extracted_events: auditEvents.length,
    auto_linked_events: auditEvents.filter(a => a.action.includes('AUTO_LINK')).length,
    review_queue_count: reviewQueue.length,
    unmatched_count: 0,
    completed_activities: completedCount,
    in_progress_activities: inProgressCount,
    overall_progress_pct: overallProgressPct,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        pendingReviewCount={reviewQueue.length} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6">
        {activeTab === 'dashboard' && (
          <Dashboard 
            kpis={kpis} 
            activities={activities} 
            onNavigateTab={setActiveTab} 
          />
        )}

        {activeTab === 'upload' && (
          <DocumentUpload 
            onAddObservations={handleAddObservations} 
            onNavigateTab={setActiveTab} 
          />
        )}

        {activeTab === 'review' && (
          <ReviewQueue 
            items={reviewQueue} 
            onApprove={handleApproveProposal} 
            onReject={handleRejectProposal} 
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
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        NEXORA AI — Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Projects · Smart India Hackathon Prototype
      </footer>
    </div>
  );
}

export default App;
