import type {
  ActivityWithState,
  AuditEvent,
  AuthUser,
  Project,
  ReviewQueueItem,
  WorkObservation,
} from '../types';

export const STORAGE_KEY = 'nexora-project-state-v2';

export function safeReadStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const defaultUser: AuthUser = {
  id: 'usr-planner-001',
  email: 'planner@nexora.ai',
  full_name: 'Vikram Singh (Lead Planner)',
  role: 'PLANNER',
};

export const defaultJwtToken: string =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpdHhnc2hyanB5dmN6aWR6dnRvIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJzdWIiOiJ1c3ItcGxhbm5lci0wMDEiLCJlbWFpbCI6InBsYW5uZXJAbmV4b3JhLmFpIiwiZXhwIjoyMTAzNjU2NzY3LCJpYXQiOjE3ODgwODA3NjcsInVzZXJfbWV0YWRhdGEiOnsiZnVsbF9uYW1lIjoiVmlrcmFtIFNpbmdoIiwicm9sZSI6IlBMQU5ORVIifX0.mock_signature_valid';

export const DEFAULT_PROJECTS: Project[] = [
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
  },
];

export const initialActivities: ActivityWithState[] = [
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
  },
];

export function getDefaultObservations(projectId: string): WorkObservation[] {
  return [
    {
      id: 'obs-001',
      project_id: projectId,
      raw_text: 'Spool erection on Pipe Rack B Tier 2 completed with alignment check and bolt torque tightening done.',
      normalized_text: 'Spool Erection on Pipe Rack B Tier 2 completed',
      discipline: 'PIPING',
      location: 'Pipe Rack B',
      zone: 'Zone 2',
      equipment_tag: 'RACK-B-CS',
      recorded_at: '2026-08-25T11:30:00Z',
      event_type: 'PROGRESS',
      reported_progress: 80,
    },
  ];
}

export function getDefaultReviewQueue(projectId: string, activities: ActivityWithState[]): ReviewQueueItem[] {
  return [
    {
      proposal: {
        id: '20000000-0000-0000-0000-000000000005',
        project_id: projectId,
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
        project_id: projectId,
        raw_text: 'Hydrostatic testing completed along Pipe Rack B headers yesterday afternoon.',
        normalized_text: 'Hydrostatic Testing completed along Pipe Rack B headers',
        discipline: 'PIPING',
        recorded_at: new Date().toISOString(),
        event_type: 'FINISH',
      },
      activity: activities[1]?.activity || activities[0]?.activity,
    },
  ];
}

export function getDefaultAuditEvents(projectId: string, userId?: string): AuditEvent[] {
  return [
    {
      id: 'audit-001',
      project_id: projectId,
      entity_type: 'ACTIVITY',
      entity_id: 'd0000000-0000-0000-0000-000000000004',
      action: 'APPROVE_ACTUAL_PROGRESS',
      actor_id: userId || '00000000-0000-0000-0000-000000000001',
      actor_role: 'LEAD_PLANNER',
      before_state: { progress_pct: 0, status: 'NOT_STARTED' },
      after_state: { progress_pct: 100, status: 'COMPLETED' },
      payload_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      created_at: '2026-08-28T14:30:00Z',
    },
  ];
}
