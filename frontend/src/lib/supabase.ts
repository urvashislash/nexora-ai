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
  type: 'reports' | 'spreadsheets' | 'images' = 'reports'
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
    return null;
  }

  return data.signedUrl;
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
