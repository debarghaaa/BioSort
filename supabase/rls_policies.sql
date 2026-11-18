-- Consolidated Row-Level Security & Storage Policy Reference
-- Canonical migration file: /supabase/migrations/202611170002_rls_and_storage.sql

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_taxonomy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bin_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

-- Role lookup function bound to auth.uid()
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Storage bucket 'waste-evidence' is private (public = FALSE), 10 MiB max, JPEG/PNG only.
-- Signed short-lived URLs are minted server-side or by authorised authenticated sessions.
