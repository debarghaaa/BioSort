-- Migration 004: Auth Profile Provisioning, Immutability Triggers, Audit Triggers & Retention Policy

-- 1. Automatically provision a default 'operator' profile when a Supabase Auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', COALESCE(NEW.email, '')),
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Maintain updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_bin_mappings_updated_at
  BEFORE UPDATE ON public.bin_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Protect audit_events from UPDATE or DELETE (strictly append-only)
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events records are immutable and cannot be modified or deleted.';
END;
$$;

CREATE TRIGGER trg_audit_events_immutable
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_mutation();

-- 4. Automatic audit trail triggers on taxonomy, bin_mappings, and manual_reviews
CREATE OR REPLACE FUNCTION public.record_governance_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_event_type TEXT;
  v_entity_id TEXT;
BEGIN
  v_actor := auth.uid();
  v_event_type := TG_TABLE_NAME || '.' || lower(TG_OP);
  v_entity_id := COALESCE(NEW.id::text, OLD.id::text);

  INSERT INTO public.audit_events (
    actor_id,
    event_type,
    entity_type,
    entity_id,
    before_state,
    after_state
  )
  VALUES (
    v_actor,
    v_event_type,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_audit_waste_taxonomy
  AFTER INSERT OR UPDATE OR DELETE ON public.waste_taxonomy
  FOR EACH ROW
  EXECUTE FUNCTION public.record_governance_audit_event();

CREATE TRIGGER trg_audit_bin_mappings
  AFTER INSERT OR UPDATE OR DELETE ON public.bin_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.record_governance_audit_event();

CREATE TRIGGER trg_audit_manual_reviews
  AFTER INSERT OR UPDATE ON public.manual_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.record_governance_audit_event();

-- 5. Configurable evidence retention helper (returns expired object paths for scheduled purge jobs)
CREATE TABLE IF NOT EXISTS public.retention_policies (
  policy_key TEXT PRIMARY KEY,
  retention_days INTEGER NOT NULL CHECK (retention_days >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read retention policy"
  ON public.retention_policies FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins manage retention policy"
  ON public.retention_policies FOR ALL
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

INSERT INTO public.retention_policies (policy_key, retention_days)
VALUES ('waste_evidence_images', 90)
ON CONFLICT (policy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.list_expired_evidence_paths()
RETURNS TABLE (classification_id UUID, image_object_path TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ce.id, ce.image_object_path, ce.created_at
  FROM public.classification_events ce
  CROSS JOIN public.retention_policies rp
  WHERE rp.policy_key = 'waste_evidence_images'
    AND ce.created_at < NOW() - make_interval(days => rp.retention_days);
$$;
