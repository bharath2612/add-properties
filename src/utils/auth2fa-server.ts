const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const VERIFY_2FA_URL = `${SUPABASE_URL}/functions/v1/verify-2fa`;

interface VerifyResult {
  valid: boolean;
  error?: string;
}

export async function verifyOTPServerSide(otp: string): Promise<VerifyResult> {
  try {
    const res = await fetch(VERIFY_2FA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ otp }),
    });

    if (res.status === 429) {
      return { valid: false, error: 'Too many attempts. Please wait 1 minute and try again.' };
    }

    const data = await res.json();

    if (!res.ok) {
      return { valid: false, error: data.error || 'Verification failed. Please try again.' };
    }

    return { valid: !!data.valid };
  } catch (err) {
    console.error('2FA verification request failed:', err);
    return { valid: false, error: 'Network error. Please check your connection.' };
  }
}
