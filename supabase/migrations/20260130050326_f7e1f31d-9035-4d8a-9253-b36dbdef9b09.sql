-- Create a public view that excludes the notes field
CREATE OR REPLACE VIEW public.fda_data_versions_public
WITH (security_invoker = on) AS
SELECT 
  id,
  created_at,
  updated_at,
  is_verified,
  is_published,
  version_number,
  data_fingerprint
FROM public.fda_data_versions
WHERE is_published = true;

-- Drop the old permissive SELECT policy
DROP POLICY IF EXISTS "Public can read published versions" ON public.fda_data_versions;

-- Create new restrictive policy - only admins can read the base table directly
CREATE POLICY "Only admins can read versions"
ON public.fda_data_versions
FOR SELECT
USING (is_admin());