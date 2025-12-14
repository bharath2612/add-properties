// Import authenticated supabase wrapper
export { authenticatedSupabase as supabase } from './supabaseAuth';

// Keep ACCESS_CODE for backward compatibility (may be used elsewhere)
export const ACCESS_CODE = import.meta.env.VITE_PROPERTY_ENTRY_ACCESS_CODE || '';

