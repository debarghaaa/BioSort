-- Consolidated Database Schema Reference
-- Canonical source of truth is /supabase/migrations/202611170001_core_tables.sql
-- through 202611170004_audit_triggers_and_retention.sql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'reviewer');
CREATE TYPE public.mapping_status_enum AS ENUM ('pending', 'verified', 'disabled');
CREATE TYPE public.decision_status_enum AS ENUM ('accepted', 'review_required', 'mapping_unconfigured', 'rejected');
CREATE TYPE public.classification_review_status_enum AS ENUM ('not_required', 'pending', 'confirmed', 'relabelled', 'unresolved');
CREATE TYPE public.manual_review_outcome_enum AS ENUM ('confirmed', 'relabelled', 'unresolved');
CREATE TYPE public.model_deployment_status_enum AS ENUM ('staged', 'active', 'retired', 'archived');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.waste_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  taxonomy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.bin_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.waste_taxonomy(id) ON DELETE RESTRICT,
  bin_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mapping_status public.mapping_status_enum NOT NULL DEFAULT 'pending',
  policy_reference TEXT NOT NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (class_id, policy_reference)
);

CREATE TABLE public.model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL UNIQUE,
  artifact_path TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (char_length(sha256) = 64),
  framework TEXT NOT NULL,
  input_shape JSONB NOT NULL,
  preprocessing_version TEXT NOT NULL,
  class_mapping_version TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  deployment_status public.model_deployment_status_enum NOT NULL DEFAULT 'staged',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.classification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  image_object_path TEXT NOT NULL UNIQUE,
  predicted_class_id UUID REFERENCES public.waste_taxonomy(id) ON DELETE RESTRICT,
  candidate_predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_score NUMERIC(6,5),
  calibrated_confidence NUMERIC(6,5),
  confidence_threshold NUMERIC(6,5),
  decision_status public.decision_status_enum NOT NULL,
  recommended_bin_code TEXT,
  review_status public.classification_review_status_enum NOT NULL DEFAULT 'pending',
  model_version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.manual_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id UUID NOT NULL UNIQUE REFERENCES public.classification_events(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  confirmed_class_id UUID REFERENCES public.waste_taxonomy(id) ON DELETE RESTRICT,
  review_outcome public.manual_review_outcome_enum NOT NULL DEFAULT 'unresolved',
  review_reason TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.retention_policies (
  policy_key TEXT PRIMARY KEY,
  retention_days INTEGER NOT NULL CHECK (retention_days >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
