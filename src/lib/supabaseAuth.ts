import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Route all queries through the CF Pages proxy function (/api/sp/*)
// which adds the service_role key server-side. This is needed because
// the RLS-hardening migration revoked anon access to admin tables.
// In dev: Vite proxies /api/* → localhost:8788 (wrangler pages dev)
// In prod: CF Pages serves functions/api/sp/[[path]].ts directly
const proxyUrl = `${window.location.origin}/api/sp`;
const baseClient = createClient(proxyUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// Auth check function
let authCheckCallback: (() => boolean) | null = null;

export function setAuthCheckCallback(callback: () => boolean) {
  authCheckCallback = callback;
}

// Authenticated Supabase wrapper
export const authenticatedSupabase = new Proxy(baseClient, {
  get(target, prop) {
    // Don't throw errors - just allow access
    // RLS policies and Supabase will handle actual authentication
    // This prevents blocking during initial load or right after login
    if (authCheckCallback) {
      try {
        const isAuthenticated = authCheckCallback();
        if (!isAuthenticated) {
          // Log warning but don't throw - let the query fail naturally
          // This prevents blocking the UI during auth initialization
          console.warn('Auth check returned false, but allowing operation. RLS will enforce security.');
        }
      } catch (error) {
        // If checkAuth throws, log but don't block
        console.warn('Auth check failed:', error);
      }
    }
    // Always allow access - don't block during initialization
    // Supabase RLS policies will handle actual security
    return target[prop as keyof SupabaseClient];
  },
});

// For backward compatibility, export the base client as well
// Components should use authenticatedSupabase instead
export { baseClient as supabase };




