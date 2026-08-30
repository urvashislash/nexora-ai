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
