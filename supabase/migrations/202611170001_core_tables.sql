-- Migration 001: Core Relational Tables, Constraints & Indexes
-- AI Medical Waste Segregation Platform
-- Strictly software-only: no patient identifiers (PHI), no bin-sensor tables,
-- and no binary image bytes stored inside PostgreSQL rows.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Canonical enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'reviewer');

CREATE TYPE public.mapping_status_enum AS ENUM ('pending', 'verified', 'disabled');

CREATE TYPE public.decision_status_enum AS ENUM (
  'accepted',
  'review_required',
  'mapping_unconfigured',
  'rejected'
);

CREATE TYPE public.classification_review_status_enum AS ENUM (
  'not_required',
  'pending',
  'confirmed',
  'relabelled',
  'unresolved'
);

CREATE TYPE public.manual_review_outcome_enum AS ENUM (
  'confirmed',
  'relabelled',
  'unresolved'
);

CREATE TYPE public.model_deployment_status_enum AS ENUM (
  'staged',
  'active',
  'retired',
  'archived'
);

-- 1. profiles (linked 1:1 to Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. waste_taxonomy (canonical classifier classes)
CREATE TABLE public.waste_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  taxonomy_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_taxonomy_no_banned_terms CHECK (
    class_code !~* '(safe|sterile|medically approved)'
    AND display_name !~* '(safe|sterile|medically approved)'
  )
);

CREATE INDEX idx_waste_taxonomy_active_version
  ON public.waste_taxonomy (active, taxonomy_version);

-- 3. bin_mappings (configurable & verified classification-to-destination mapping)
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
  CONSTRAINT uq_bin_mapping_class_policy UNIQUE (class_id, policy_reference),
  CONSTRAINT chk_mapping_no_banned_terms CHECK (
    bin_code !~* '(safe|sterile|medically approved)'
    AND display_name !~* '(safe|sterile|medically approved)'
  ),
  CONSTRAINT chk_verified_mapping_requires_approver CHECK (
    mapping_status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
  )
);

-- At most one active verified destination mapping per canonical taxonomy class
CREATE UNIQUE INDEX idx_single_verified_mapping_per_class
  ON public.bin_mappings (class_id)
  WHERE mapping_status = 'verified';

CREATE INDEX idx_bin_mappings_status
  ON public.bin_mappings (mapping_status, class_id);

-- 4. model_versions (ONNX model artefact registry)
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

CREATE UNIQUE INDEX idx_single_active_model_version
  ON public.model_versions (deployment_status)
  WHERE deployment_status = 'active';

CREATE INDEX idx_model_versions_created
  ON public.model_versions (created_at DESC);

-- 5. classification_events (persistent record of every classification request)
CREATE TABLE public.classification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  image_object_path TEXT NOT NULL UNIQUE,
  predicted_class_id UUID REFERENCES public.waste_taxonomy(id) ON DELETE RESTRICT,
  candidate_predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_score NUMERIC(6,5) CHECK (model_score IS NULL OR (model_score >= 0 AND model_score <= 1)),
  calibrated_confidence NUMERIC(6,5) CHECK (
    calibrated_confidence IS NULL OR (calibrated_confidence >= 0 AND calibrated_confidence <= 1)
  ),
  confidence_threshold NUMERIC(6,5) CHECK (
    confidence_threshold IS NULL OR (confidence_threshold > 0 AND confidence_threshold <= 1)
  ),
  decision_status public.decision_status_enum NOT NULL,
  recommended_bin_code TEXT,
  review_status public.classification_review_status_enum NOT NULL DEFAULT 'pending',
  model_version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_recommended_bin_only_when_accepted CHECK (
    decision_status = 'accepted' OR recommended_bin_code IS NULL
  ),
  CONSTRAINT chk_accepted_must_have_bin CHECK (
    decision_status <> 'accepted' OR recommended_bin_code IS NOT NULL
  ),
  CONSTRAINT chk_uncertain_requires_review_status CHECK (
    decision_status NOT IN ('review_required', 'mapping_unconfigured')
    OR review_status <> 'not_required'
  ),
  CONSTRAINT chk_events_no_banned_terms CHECK (
    COALESCE(recommended_bin_code, '') !~* '(safe|sterile|medically approved)'
  )
);

CREATE INDEX idx_classification_events_created_at
  ON public.classification_events (created_at DESC);

CREATE INDEX idx_classification_events_predicted_class
  ON public.classification_events (predicted_class_id, created_at DESC);

CREATE INDEX idx_classification_events_model_version
  ON public.classification_events (model_version_id, created_at DESC);

CREATE INDEX idx_classification_events_review_status
  ON public.classification_events (review_status, created_at DESC);

CREATE INDEX idx_classification_events_decision_status
  ON public.classification_events (decision_status, created_at DESC);

CREATE INDEX idx_classification_events_created_by
  ON public.classification_events (created_by, created_at DESC);

-- 6. manual_reviews (traceable human review of uncertain classifications)
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

CREATE INDEX idx_manual_reviews_outcome_created
  ON public.manual_reviews (review_outcome, created_at DESC);

CREATE INDEX idx_manual_reviews_reviewer
  ON public.manual_reviews (reviewer_id, reviewed_at DESC);

-- 7. audit_events (immutable traceability log)
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

CREATE INDEX idx_audit_events_created_at
  ON public.audit_events (created_at DESC);

CREATE INDEX idx_audit_events_entity
  ON public.audit_events (entity_type, entity_id, created_at DESC);
