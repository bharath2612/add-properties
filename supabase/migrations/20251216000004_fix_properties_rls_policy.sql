-- Fix RLS policies for properties table to allow reading all properties
-- This ensures the dashboard can count and display all properties correctly

-- Enable RLS on properties table if not already enabled
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to all properties" ON public.properties;
DROP POLICY IF EXISTS "Allow authenticated read access to all properties" ON public.properties;
DROP POLICY IF EXISTS "Allow anon read access to all properties" ON public.properties;

-- Create policy to allow public (anon) users to read all properties
-- This is needed for the dashboard to show accurate counts
CREATE POLICY "Allow public read access to all properties"
ON public.properties
FOR SELECT
TO anon, authenticated
USING (true);

-- Optional: If you want to restrict to authenticated users only, use this instead:
-- CREATE POLICY "Allow authenticated read access to all properties"
-- ON public.properties
-- FOR SELECT
-- TO authenticated
-- USING (true);

-- Note: If you need to restrict certain properties (e.g., based on is_partner_project),
-- you can modify the USING clause. For example:
-- USING (is_partner_project = true OR is_partner_project IS NULL)


