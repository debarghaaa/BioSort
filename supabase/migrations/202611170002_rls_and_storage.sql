-- Migration 002: Row-Level Security (RLS) Policies & Private Evidence Storage
-- Strict role separation: admin, operator, reviewer.
-- Service-role key remains exclusively on backend services.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Helper returning authenticated user's role from public.profiles
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 1. profiles policies
CREATE POLICY "Users can view own profile; reviewers/admins view staff profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.current_app_role() IN ('reviewer', 'admin')
  );

CREATE POLICY "Users can update own display name without changing role"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Admins manage all profiles and roles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- 2. waste_taxonomy policies (read for authenticated, write strictly admin)
CREATE POLICY "Authenticated users read waste taxonomy"
  ON public.waste_taxonomy FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins manage waste taxonomy"
  ON public.waste_taxonomy FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "Admins update waste taxonomy"
  ON public.waste_taxonomy FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "Admins delete waste taxonomy"
  ON public.waste_taxonomy FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'admin');

-- 3. bin_mappings policies (read for authenticated, write/verify strictly admin)
CREATE POLICY "Authenticated users read bin mappings"
  ON public.bin_mappings FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins insert bin mappings"
  ON public.bin_mappings FOR INSERT
  TO authenticated
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "Admins update and verify bin mappings"
  ON public.bin_mappings FOR UPDATE
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

CREATE POLICY "Admins delete bin mappings"
  ON public.bin_mappings FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'admin');

-- 4. model_versions policies (read for authenticated, write strictly admin)
CREATE POLICY "Authenticated users read model versions"
  ON public.model_versions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins manage model versions"
  ON public.model_versions FOR ALL
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

-- 5. classification_events policies
-- Operators read their own records; reviewers & admins read all records
CREATE POLICY "Operators read own classification events; reviewers and admins read all"
  ON public.classification_events FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.current_app_role() IN ('reviewer', 'admin')
  );

CREATE POLICY "Authenticated operators/reviewers/admins insert own classification events"
  ON public.classification_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.current_app_role() IN ('operator', 'reviewer', 'admin')
  );

-- Only reviewers/admins may update review_status during manual review resolution
CREATE POLICY "Reviewers and admins update classification review_status"
  ON public.classification_events FOR UPDATE
  TO authenticated
  USING (public.current_app_role() IN ('reviewer', 'admin'))
  WITH CHECK (public.current_app_role() IN ('reviewer', 'admin'));

-- 6. manual_reviews policies
CREATE POLICY "Operators read reviews of own events; reviewers and admins read all"
  ON public.manual_reviews FOR SELECT
  TO authenticated
  USING (
    public.current_app_role() IN ('reviewer', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.classification_events ce
      WHERE ce.id = manual_reviews.classification_id
        AND ce.created_by = auth.uid()
    )
  );

CREATE POLICY "Reviewers and admins insert manual reviews"
  ON public.manual_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('reviewer', 'admin')
    AND (reviewer_id IS NULL OR reviewer_id = auth.uid())
  );

CREATE POLICY "Reviewers and admins submit review decisions"
  ON public.manual_reviews FOR UPDATE
  TO authenticated
  USING (public.current_app_role() IN ('reviewer', 'admin'))
  WITH CHECK (
    public.current_app_role() IN ('reviewer', 'admin')
    AND reviewer_id = auth.uid()
  );

-- 7. audit_events policies (append-only; strictly protected from modification/deletion)
CREATE POLICY "Reviewers and admins read audit events"
  ON public.audit_events FOR SELECT
  TO authenticated
  USING (public.current_app_role() IN ('reviewer', 'admin'));

CREATE POLICY "Authenticated actors insert own audit events"
  ON public.audit_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- Private Evidence Storage Bucket (never public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waste-evidence',
  'waste-evidence',
  FALSE,
  10485760,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

-- Drop legacy overly-broad storage policies if present
DROP POLICY IF EXISTS "Authenticated upload evidence images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read evidence images" ON storage.objects;

-- Enforce user-scoped path prefix "<auth.uid()>/..." for direct client uploads and strict read access
CREATE POLICY "Authenticated users upload own waste evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'waste-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners, reviewers, and admins read waste evidence for signed URLs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'waste-evidence'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.current_app_role() IN ('reviewer', 'admin')
    )
  );
