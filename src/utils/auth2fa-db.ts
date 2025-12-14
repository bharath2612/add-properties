/**
 * Database-backed 2FA secret storage
 * Stores the secret in Supabase so it's shared across all browsers/users
 */

// Use base client for 2FA secret operations (needed before authentication)
import { supabase } from '../lib/supabaseAuth';

const TOTP_SECRET_TABLE = 'dashboard_2fa_secret';

// Get the 2FA secret from database
export async function getTOTPSecretFromDB(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(TOTP_SECRET_TABLE)
      .select('secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return null;
      }
      return null;
    }

    return data?.secret || null;
  } catch (error) {
    return null;
  }
}

// Save the 2FA secret to database
export async function saveTOTPSecretToDB(secret: string): Promise<boolean> {
  try {
    // Check if secret already exists
    const existing = await getTOTPSecretFromDB();
    
    if (existing) {
      // Update existing secret - delete old and insert new (simpler than update)
      const { error: deleteError } = await supabase
        .from(TOTP_SECRET_TABLE)
        .delete()
        .neq('id', 0); // Delete all rows

      if (deleteError) {
        // Continue with insert even if delete fails
      }
    }
    
    // Insert new secret
    const { error } = await supabase
      .from(TOTP_SECRET_TABLE)
      .insert({ 
        secret,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        throw new Error('2FA secret table does not exist. Please create the table in Supabase.');
      }
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

// Clear the 2FA secret from database
export async function clearTOTPSecretFromDB(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TOTP_SECRET_TABLE)
      .delete()
      .neq('id', 0); // Delete all rows

    if (error) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

