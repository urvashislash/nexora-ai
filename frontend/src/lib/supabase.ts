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
 * Retrieves the current authenticated user.
 */
export async function getCurrentUser() {
  if (!supabaseInstance) return null;
  const { data: { user }, error } = await supabaseInstance.auth.getUser();
  if (error) {
    console.error('[NEXORA] Auth Error:', error.message);
    return null;
  }
  return user;
}

/**
 * Fetches the user's role in a specific project.
 */
export async function getUserRole(projectId: string): Promise<string | null> {
  if (!supabaseInstance) return null;
  
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabaseInstance
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single();

  if (error) {
    console.error('[NEXORA] Role fetch error:', error.message);
    return null;
  }

  return data?.role || null;
}
