/**
 * Database-backed 2FA secret storage
 * Stores the secret in Supabase so it's shared across all browsers/users
 */

// Use base client for 2FA secret operations (needed before authentication)
import { supabase } from '../lib/supabaseAuth';

const TOTP_SECRET_TABLE = 'dashboard_2fa_secret';

// Debug function to check table status
export async function debugTOTPSecretTable(): Promise<void> {
  try {
    console.log('🔍 Debugging 2FA secret table...');
    console.log('Table name:', TOTP_SECRET_TABLE);
    
    // Try to count rows
    const { count, error: countError } = await supabase
      .from(TOTP_SECRET_TABLE)
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting rows:', countError);
      return;
    }
    
    console.log(`✅ Table exists. Row count: ${count}`);
    
    // Try to fetch all rows (without secret for security)
    const { data, error } = await supabase
      .from(TOTP_SECRET_TABLE)
      .select('id, created_at, updated_at')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching rows:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ Found ${data.length} row(s):`, data.map(row => ({
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })));
      
      // Try to fetch the actual secret (just to verify it exists)
      const { data: secretData } = await supabase
        .from(TOTP_SECRET_TABLE)
        .select('secret')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (secretData?.secret) {
        console.log(`✅ Secret exists and has ${secretData.secret.length} characters`);
      } else {
        console.warn('⚠️ Secret field is null or empty');
      }
    } else {
      console.warn('⚠️ Table exists but has no rows');
    }
  } catch (error: any) {
    console.error('❌ Exception in debug function:', error);
  }
}

// Get the 2FA secret from database
export async function getTOTPSecretFromDB(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(TOTP_SECRET_TABLE)
      .select('secret')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

    if (error) {
      console.error('Error fetching 2FA secret from database:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      // PGRST116 = no rows found (but maybeSingle handles this, so this might be a different error)
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        console.warn('2FA secret table may not exist or has no records');
        return null;
      }
      
      // Check if it's a table not found error
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.error('2FA secret table does not exist in database');
        return null;
      }
      
      return null;
    }

    if (!data) {
      console.warn('No 2FA secret found in database (table exists but is empty)');
      return null;
    }

    console.log('Successfully fetched 2FA secret from database');
    return data.secret || null;
  } catch (error: any) {
    console.error('Exception while fetching 2FA secret:', error);
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

