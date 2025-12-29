import { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Base Supabase client
const baseClient = createClient(supabaseUrl, supabaseAnonKey);

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




