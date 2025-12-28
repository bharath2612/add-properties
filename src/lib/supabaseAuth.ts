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
    // Check authentication before any operation
    if (authCheckCallback && !authCheckCallback()) {
      throw new Error('Session expired. Please login again.');
    }
    return target[prop as keyof SupabaseClient];
  },
});

// For backward compatibility, export the base client as well
// Components should use authenticatedSupabase instead
export { baseClient as supabase };




