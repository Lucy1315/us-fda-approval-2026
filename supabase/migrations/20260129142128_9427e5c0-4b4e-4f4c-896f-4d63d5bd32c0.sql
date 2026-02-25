-- Roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper: check role (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Allow users to see their own roles; and allow a one-time bootstrap admin
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Bootstrap first admin"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'
  AND user_id = auth.uid()
  AND (SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin') = 0
);

-- FDA data versioning
CREATE TABLE IF NOT EXISTS public.fda_data_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number bigint GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  is_verified boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT true,
  data_fingerprint text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.fda_data_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.fda_data_versions(id) ON DELETE CASCADE,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fda_data_rows_version_id ON public.fda_data_rows(version_id);

ALTER TABLE public.fda_data_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fda_data_rows ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fda_data_versions_updated_at ON public.fda_data_versions;
CREATE TRIGGER trg_fda_data_versions_updated_at
BEFORE UPDATE ON public.fda_data_versions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Latest version helpers
CREATE OR REPLACE FUNCTION public.get_latest_published_version_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.fda_data_versions
  WHERE is_published = true
  ORDER BY version_number DESC
  LIMIT 1;
$$;

-- Views for consumption (security_invoker=on)
CREATE OR REPLACE VIEW public.public_fda_data_view
WITH (security_invoker=on)
AS
  SELECT r.payload
  FROM public.fda_data_rows r
  WHERE r.version_id = public.get_latest_published_version_id();

-- RLS policies
CREATE POLICY "Public can read published versions"
ON public.fda_data_versions
FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_admin());

CREATE POLICY "Admins can insert versions"
ON public.fda_data_versions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update versions"
ON public.fda_data_versions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Public can read published rows"
ON public.fda_data_rows
FOR SELECT
TO anon, authenticated
USING (version_id = public.get_latest_published_version_id() OR public.is_admin());

CREATE POLICY "Admins can write rows"
ON public.fda_data_rows
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
