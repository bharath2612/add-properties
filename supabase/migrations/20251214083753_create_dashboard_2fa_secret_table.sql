-- Migration: Create dashboard_2fa_secret table
-- This table stores the shared 2FA TOTP secret for dashboard authentication

CREATE TABLE IF NOT EXISTS dashboard_2fa_secret (
  id SERIAL PRIMARY KEY,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_2fa_secret_created ON dashboard_2fa_secret(created_at DESC);

-- Add RLS (Row Level Security) policy to allow authenticated reads
ALTER TABLE dashboard_2fa_secret ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Allow read access to 2FA secret" ON dashboard_2fa_secret;
DROP POLICY IF EXISTS "Allow insert/update of 2FA secret" ON dashboard_2fa_secret;

-- Policy: Allow anyone to read the secret (since it's needed for login)
CREATE POLICY "Allow read access to 2FA secret" ON dashboard_2fa_secret
  FOR SELECT
  USING (true);

-- Policy: Allow insert/update (you may want to restrict this to admins only later)
CREATE POLICY "Allow insert/update of 2FA secret" ON dashboard_2fa_secret
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to automatically update updated_at timestamp
-- Uses the existing tg_set_updated_at() function for consistency
DROP TRIGGER IF EXISTS trg_dashboard_2fa_secret_updated_at ON dashboard_2fa_secret;
CREATE TRIGGER trg_dashboard_2fa_secret_updated_at
  BEFORE UPDATE ON dashboard_2fa_secret
  FOR EACH ROW
  EXECUTE FUNCTION tg_set_updated_at();

-- Add a comment
COMMENT ON TABLE dashboard_2fa_secret IS 'Stores the shared 2FA TOTP secret for dashboard authentication';

