import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    console.warn('[NEXORA] Supabase init failed — running in local-only mode:', e);
  }
}

// Export a proxy that won't crash callers when Supabase isn't configured.
// Any .auth.getSession() call will resolve to { data: { session: null }, error: null }.
export const supabase: SupabaseClient = supabaseInstance ?? ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
  },
} as unknown as SupabaseClient);

export function getSupabaseStatus() {
  return {
    url: supabaseUrl || '(not configured)',
    configured: Boolean(supabaseInstance),
  };
}

/**
 * Uploads an evidence file to the Supabase storage bucket.
 * 
 * @param projectId The UUID of the project
 * @param file The file object from a file input
 * @param type The type of document (e.g., 'reports', 'spreadsheets', 'images')
 * @returns The storage path of the uploaded file, or null if failed.
 */
export async function uploadEvidenceFile(
  projectId: string,
  file: File,
  type: 'reports' | 'spreadsheets' | 'images' | 'audio' | 'voice' = 'reports'
): Promise<string | null> {
  if (!supabaseInstance) {
    console.warn('[NEXORA] Cannot upload file — Supabase not configured.');
    return null;
  }

  // Create a clean, timestamped path: {project_id}/{type}/{timestamp}_{filename}
  const timestamp = new Date().getTime();
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${projectId}/${type}/${timestamp}_${cleanFileName}`;

  const { data, error } = await supabaseInstance
    .storage
    .from('evidence-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('[NEXORA] Error uploading file:', error.message);
    return null;
  }

  return data.path;
}

// =========================================================================
// Direct Supabase DB Persistence (bypasses Rust backend for reliability)
// =========================================================================

/**
 * Inserts a work observation directly into the Supabase `work_observations` table.
 * This ensures data persists even when the Rust backend is sleeping/offline.
 */
export async function insertObservation(obs: {
  id?: string;
  project_id: string;
  raw_text: string;
  normalized_text?: string;
  discipline?: string;
  location?: string;
  zone?: string;
  equipment_tag?: string;
  event_type?: string;
  reported_progress?: number;
  reported_quantity?: number;
  unit_of_measure?: string;
  observed_at?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string } | null> {
  if (!supabaseInstance) {
    console.warn('[NEXORA] Cannot insert observation — Supabase not configured.');
    return null;
  }

  const row: Record<string, unknown> = {
    project_id: obs.project_id,
    raw_text: obs.raw_text,
    normalized_text: obs.normalized_text || obs.raw_text,
    discipline: obs.discipline || null,
    location: obs.location || null,
    zone: obs.zone || null,
    equipment_tag: obs.equipment_tag || null,
    event_type: obs.event_type || null,
    reported_progress: obs.reported_progress ?? null,
    reported_quantity: obs.reported_quantity ?? null,
    unit_of_measure: obs.unit_of_measure || null,
    observed_at: obs.observed_at || new Date().toISOString(),
    recorded_at: new Date().toISOString(),
    metadata: obs.metadata || {},
  };

  // Use the caller-supplied ID if it's a valid UUID, otherwise let Supabase generate one
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (obs.id && uuidRegex.test(obs.id)) {
    row.id = obs.id;
  }

  const { data, error } = await supabaseInstance
    .from('work_observations')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[NEXORA] Error inserting observation:', error.message);
    return null;
  }

  return data;
}

/**
 * Fetches all work observations for a project from Supabase.
 */
export async function fetchObservationsFromDB(projectId: string) {
  if (!supabaseInstance) return null;

  const { data, error } = await supabaseInstance
    .from('work_observations')
    .select('*')
    .eq('project_id', projectId)
    .order('recorded_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[NEXORA] Error fetching observations:', error.message);
    return null;
  }

  return data;
}

/**
 * Fetches activities joined with their current state from Supabase.
 */
export async function fetchActivitiesWithState(projectId: string) {
  if (!supabaseInstance) return null;

  const { data: activities, error: actErr } = await supabaseInstance
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .order('planned_start_date', { ascending: true });

  if (actErr || !activities || activities.length === 0) {
    return null;
  }

  const { data: states } = await supabaseInstance
    .from('activity_current_state')
    .select('*')
    .eq('project_id', projectId);

  return activities.map((act: any) => {
    const state = states?.find((s: any) => s.activity_id === act.id);
    return { activity: act, state: state || undefined };
  });
}

/**
 * Fetches audit events from Supabase.
 */
export async function fetchAuditEventsFromDB(projectId: string) {
  if (!supabaseInstance) return null;

  const { data, error } = await supabaseInstance
    .from('audit_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[NEXORA] Error fetching audit events:', error.message);
    return null;
  }

  return data;
}

/**
 * Gets a permanent direct URL to preview or play an evidence/audio file.
 */
export function getEvidencePublicUrl(filePath: string): string {
  if (!supabaseUrl) return '';
  const cleanPath = filePath.replace(/^\/+/, '');
  return `${supabaseUrl}/storage/v1/object/public/evidence-documents/${cleanPath}`;
}

/**
 * Gets a signed URL to download or preview a file.
 */
export async function getEvidenceFileUrl(filePath: string): Promise<string | null> {
  if (!supabaseInstance) return null;

  const { data, error } = await supabaseInstance
    .storage
    .from('evidence-documents')
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) {
    console.error('[NEXORA] Error getting signed URL:', error.message);
    return getEvidencePublicUrl(filePath);
  }

  return data.signedUrl || getEvidencePublicUrl(filePath);
}

/**
 * Decodes and parses a JWT Bearer token into structured claims.
 */
export function parseJwt(token: string): import('../types').JwtClaims | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('[NEXORA] Error parsing JWT token:', e);
    return null;
  }
}

/**
 * Signs in a user with email and password via Supabase Auth.
 */
export async function signInWithEmail(email: string, password: string) {
  if (!supabaseInstance) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabaseInstance.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Signs up a new user with email, password, full name, and role.
 */
export async function signUpWithEmail(
  email: string, 
  password: string, 
  fullName: string, 
  role: import('../types').UserRole = 'PLANNER'
) {
  if (!supabaseInstance) {
    throw new Error('Supabase is not configured.');
  }
  const { data, error } = await supabaseInstance.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: role,
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Signs out the currently authenticated user.
 */
export async function signOut() {
  if (!supabaseInstance) return;
  const { error } = await supabaseInstance.auth.signOut();
  if (error) {
    console.error('[NEXORA] Sign out error:', error.message);
  }
}

/**
 * Fetches all available projects from Supabase DB.
 */
export async function fetchProjects(): Promise<import('../types').Project[]> {
  if (!supabaseInstance) return [];

  const { data, error } = await supabaseInstance
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NEXORA] Error fetching projects:', error.message);
    return [];
  }

  return (data || []) as import('../types').Project[];
}

/**
 * Creates a new project in the database with a baseline schedule version and initial activities.
 */
export async function createProjectInDB(
  input: import('../types').ProjectCreateInput,
  userId?: string
): Promise<import('../types').Project | null> {
  if (!supabaseInstance) return null;

  try {
    // 1. Insert Project Row
    const { data: projectData, error: projError } = await supabaseInstance
      .from('projects')
      .insert({
        code: input.code.toUpperCase().trim(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        timezone: input.timezone || 'Asia/Kolkata',
        currency: input.currency || 'INR',
      })
      .select()
      .single();

    if (projError || !projectData) {
      console.error('[NEXORA] Error creating project:', projError?.message);
      throw projError;
    }

    const newProject = projectData as import('../types').Project;

    // 2. Associate Creator in project_members if userId is present
    if (userId) {
      await supabaseInstance.from('project_members').insert({
        project_id: newProject.id,
        user_id: userId,
        email: 'creator@nexora.ai',
        full_name: 'Lead Planner',
        role: 'ADMIN',
      });
    }

    // 3. Create initial Schedule Version (v1 BASELINE)
    const { data: versionData, error: verError } = await supabaseInstance
      .from('schedule_versions')
      .insert({
        project_id: newProject.id,
        version_number: 1,
        version_label: 'Baseline Revision 0',
        version_type: 'BASELINE',
        is_active: true,
      })
      .select()
      .single();

    if (verError || !versionData) {
      console.warn('[NEXORA] Schedule version creation skipped:', verError?.message);
      return newProject;
    }

    // 4. Create Root WBS Node
    const { data: wbsData } = await supabaseInstance
      .from('wbs_nodes')
      .insert({
        project_id: newProject.id,
        schedule_version_id: versionData.id,
        wbs_code: `${newProject.code}.1`,
        name: 'General Execution',
        level: 1,
        path: `${newProject.code}.1`,
      })
      .select()
      .single();

    const wbsId = wbsData?.id;

    // 5. Insert Baseline Activities if provided
    if (input.baselineActivities && input.baselineActivities.length > 0 && wbsId) {
      const activitiesToInsert = input.baselineActivities.map((act) => ({
        project_id: newProject.id,
        schedule_version_id: versionData.id,
        wbs_id: wbsId,
        code: act.code,
        name: act.name,
        description: act.description || null,
        discipline: act.discipline,
        planned_start_date: act.planned_start_date,
        planned_finish_date: act.planned_finish_date,
        planned_duration_days: act.planned_duration_days,
        planned_quantity: act.planned_quantity || null,
        unit_of_measure: act.unit_of_measure || null,
        location: act.location || null,
        zone: act.zone || null,
        equipment_tag: act.equipment_tag || null,
        weightage: act.weightage || 1.0,
        critical_path: Boolean(act.critical_path),
      }));

      const { data: insertedActs } = await supabaseInstance
        .from('activities')
        .insert(activitiesToInsert)
        .select();

      // Initialize state for each activity
      if (insertedActs && insertedActs.length > 0) {
        const statesToInsert = insertedActs.map((act) => ({
          activity_id: act.id,
          project_id: newProject.id,
          execution_status: 'NOT_STARTED',
          current_progress_pct: 0,
          cumulative_quantity: 0,
        }));

        await supabaseInstance.from('activity_current_state').insert(statesToInsert);
      }
    }

    return newProject;
  } catch (err) {
    console.error('[NEXORA] Failed to create project and schedule:', err);
    return null;
  }
}

/**
 * Fetches all activities along with their execution states for a specific project.
 */
export async function fetchProjectActivities(projectId: string): Promise<import('../types').ActivityWithState[]> {
  if (!supabaseInstance) return [];

  const { data: acts, error: actError } = await supabaseInstance
    .from('activities')
    .select('*')
    .eq('project_id', projectId)
    .order('planned_start_date', { ascending: true });

  if (actError || !acts) {
    console.error('[NEXORA] Error fetching activities for project:', actError?.message);
    return [];
  }

  const { data: states } = await supabaseInstance
    .from('activity_current_state')
    .select('*')
    .eq('project_id', projectId);

  const stateMap = new Map((states || []).map((s: any) => [s.activity_id, s]));

  return acts.map((act: any) => ({
    activity: act as import('../types').Activity,
    state: stateMap.get(act.id) as import('../types').ActivityCurrentState | undefined,
  }));
}

/**
 * Fetches work observations for a specific project.
 */
export async function fetchProjectObservations(projectId: string): Promise<import('../types').WorkObservation[]> {
  if (!supabaseInstance) return [];

  const { data, error } = await supabaseInstance
    .from('work_observations')
    .select('*')
    .eq('project_id', projectId)
    .order('recorded_at', { ascending: false });

  if (error) {
    console.error('[NEXORA] Error fetching project observations:', error.message);
    return [];
  }

  return (data || []) as import('../types').WorkObservation[];
}

/**
 * Fetches match proposals for a specific project.
 */
export async function fetchProjectProposals(projectId: string): Promise<import('../types').MatchProposal[]> {
  if (!supabaseInstance) return [];

  const { data, error } = await supabaseInstance
    .from('match_proposals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[NEXORA] Error fetching project proposals:', error.message);
    return [];
  }

  return (data || []) as import('../types').MatchProposal[];
}

/**
 * Fetches audit ledger events for a specific project.
 */
export async function fetchProjectAuditEvents(projectId: string): Promise<import('../types').AuditEvent[]> {
  if (!supabaseInstance) return [];

  const { data, error } = await supabaseInstance
    .from('audit_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[NEXORA] Error fetching project audit events:', error.message);
    return [];
  }

  return (data || []) as import('../types').AuditEvent[];
}

/**
 * Subscribes to real-time database changes for a specific project.
 */
export function subscribeToProjectRealtime(
  projectId: string,
  callbacks: {
    onObservationChange?: (payload: any) => void;
    onProposalChange?: (payload: any) => void;
    onStateChange?: (payload: any) => void;
    onAuditChange?: (payload: any) => void;
  }
) {
  if (!supabaseInstance) return () => {};

  const channel = supabaseInstance
    .channel(`project-realtime-${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'work_observations', filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onObservationChange?.(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'match_proposals', filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onProposalChange?.(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'activity_current_state', filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onStateChange?.(payload)
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'audit_events', filter: `project_id=eq.${projectId}` },
      (payload) => callbacks.onAuditChange?.(payload)
    )
    .subscribe();

  return () => {
    supabaseInstance?.removeChannel(channel);
  };
}

