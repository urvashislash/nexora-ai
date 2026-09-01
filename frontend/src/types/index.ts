export type Discipline = 
  | 'CIVIL' 
  | 'PIPING' 
  | 'MECHANICAL' 
  | 'ELECTRICAL' 
  | 'INSTRUMENTATION' 
  | 'HSE' 
  | 'GENERAL';

export type EventType = 
  | 'START' 
  | 'PROGRESS' 
  | 'FINISH' 
  | 'DELAY' 
  | 'BLOCKER' 
  | 'INSPECTION';

export type LifecycleStatus = 
  | 'PROPOSED' 
  | 'MATCHED' 
  | 'REVIEW_REQUIRED' 
  | 'APPROVED' 
  | 'COMMITTED' 
  | 'REJECTED';

export type VerificationStatus = 
  | 'UNVERIFIED' 
  | 'SYSTEM_VERIFIED' 
  | 'HUMAN_VERIFIED';

export type ExecutionStatus = 
  | 'NOT_STARTED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'DELAYED' 
  | 'BLOCKED';

export type UserRole = 
  | 'ADMIN' 
  | 'PLANNER' 
  | 'ENGINEER' 
  | 'SUPERVISOR' 
  | 'AUDITOR' 
  | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  avatar_url?: string;
}

export interface JwtClaims {
  sub: string;
  email?: string;
  role?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  timezone: string;
  currency: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCreateInput {
  code: string;
  name: string;
  description?: string;
  timezone?: string;
  currency?: string;
  baselineActivities?: BaselineActivityInput[];
}

export interface BaselineActivityInput {
  code: string;
  name: string;
  description?: string;
  discipline: Discipline;
  planned_start_date: string;
  planned_finish_date: string;
  planned_duration_days: number;
  planned_quantity?: number;
  unit_of_measure?: string;
  location?: string;
  zone?: string;
  equipment_tag?: string;
  weightage?: number;
  critical_path?: boolean;
}

export interface Activity {
  id: string;
  project_id: string;
  schedule_version_id: string;
  wbs_id: string;
  code: string;
  name: string;
  description?: string;
  discipline: Discipline;
  planned_start_date: string;
  planned_finish_date: string;
  planned_duration_days: number;
  planned_quantity?: number;
  unit_of_measure?: string;
  location?: string;
  zone?: string;
  equipment_tag?: string;
  weightage: number;
  critical_path: boolean;
}

export interface ActivityCurrentState {
  activity_id: string;
  project_id: string;
  execution_status: ExecutionStatus;
  actual_start_date?: string;
  actual_finish_date?: string;
  current_progress_pct: number;
  cumulative_quantity: number;
  last_event_id?: string;
  last_event_date?: string;
  is_critical_path_delayed: boolean;
  variance_days: number;
  updated_at: string;
}

export interface ActivityWithState {
  activity: Activity;
  state?: ActivityCurrentState;
}

export interface WorkObservation {
  id: string;
  project_id: string;
  document_id?: string;
  reported_by?: string;
  observed_at?: string;
  recorded_at: string;
  discipline?: Discipline;
  location?: string;
  zone?: string;
  equipment_tag?: string;
  raw_text: string;
  normalized_text?: string;
  event_type?: EventType;
  reported_progress?: number;
  reported_quantity?: number;
  unit_of_measure?: string;
  metadata?: Record<string, any>;
}

export interface MatchCandidate {
  activity_id: string;
  activity_code: string;
  activity_name: string;
  candidate_rank: number;
  lexical_score: number;
  semantic_score: number;
  context_boost: number;
  confidence_score: number;
  match_tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';
  explanation: string;
  evidence_snippet: string;
}

export interface MatchProposal {
  id: string;
  project_id: string;
  observation_id: string;
  activity_id: string;
  candidate_rank: number;
  lexical_score: number;
  semantic_score: number;
  context_boost: number;
  confidence_score: number;
  match_tier: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED';
  explanation?: string;
  evidence_snippet?: string;
  status: 'PROPOSED' | 'AUTO_LINKED' | 'PENDING_REVIEW' | 'ACCEPTED' | 'OVERRIDDEN' | 'REJECTED';
  created_at: string;
}

export type ReviewDecision = 'APPROVE' | 'REJECT' | 'OVERRIDE';

export interface ReviewQueueFilters {
  discipline?: Discipline | 'ALL';
  matchTier?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNMATCHED' | 'ALL';
  minConfidence?: number;
  sortBy?: 'confidence_asc' | 'confidence_desc' | 'date_asc' | 'date_desc';
  searchQuery?: string;
}

export interface ReviewQueueItem {
  proposal: MatchProposal;
  observation?: WorkObservation;
  activity?: Activity;
  alternativeCandidates?: MatchCandidate[];
}

export interface Approval {
  id: string;
  project_id: string;
  event_id?: string;
  proposal_id?: string;
  action: ReviewDecision;
  reviewed_by: string;
  reviewed_at: string;
  selected_activity_id?: string;
  comments?: string;
  confidence_override?: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export interface ActualEvent {
  id: string;
  project_id: string;
  activity_id: string;
  observation_id?: string;
  match_proposal_id?: string;
  event_type: EventType;
  actual_date: string;
  actual_progress_pct?: number;
  actual_quantity?: number;
  delay_reason?: string;
  delay_days?: number;
  lifecycle_status: LifecycleStatus;
  verification_status: VerificationStatus;
  idempotency_key?: string;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id?: string;
  actor_role?: string;
  before_state?: any;
  after_state?: any;
  payload_hash: string;
  previous_hash?: string;
  created_at: string;
}

export interface DashboardKPIs {
  total_observations: number;
  extracted_events: number;
  auto_linked_events: number;
  review_queue_count: number;
  unmatched_count: number;
  completed_activities: number;
  in_progress_activities: number;
  overall_progress_pct: number;
}
