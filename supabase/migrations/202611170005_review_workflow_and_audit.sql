-- Migration 005: Human-in-the-Loop Manual Review Workflow, Concurrency Control,
-- Prediction Immutability, Full Audit History & Approved Dataset Feedback Export

-- 1. Extend classification_review_status_enum with 'in_progress'
ALTER TYPE public.classification_review_status_enum
  ADD VALUE IF NOT EXISTS 'in_progress';

-- 2. Dedicated queue status enum for manual_reviews
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'manual_review_queue_status_enum') THEN
    CREATE TYPE public.manual_review_queue_status_enum AS ENUM (
      'pending',
      'in_progress',
      'confirmed',
      'relabelled',
      'unresolved'
    );
  END IF;
END
$$;

-- 3. Extend manual_reviews for claim tracking, optimistic concurrency, and explicit dataset feedback approval
ALTER TABLE public.manual_reviews
  ADD COLUMN IF NOT EXISTS queue_status public.manual_review_queue_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approved_for_dataset_export BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dataset_export_approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dataset_export_approved_at TIMESTAMPTZ;

-- Backfill queue_status for any pre-existing rows
UPDATE public.manual_reviews
SET queue_status = CASE
  WHEN reviewed_at IS NULL THEN 'pending'::public.manual_review_queue_status_enum
  WHEN review_outcome = 'confirmed' THEN 'confirmed'::public.manual_review_queue_status_enum
  WHEN review_outcome = 'relabelled' THEN 'relabelled'::public.manual_review_queue_status_enum
  ELSE 'unresolved'::public.manual_review_queue_status_enum
END
WHERE queue_status = 'pending' AND reviewed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_manual_reviews_queue_status_created
  ON public.manual_reviews (queue_status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_manual_reviews_dataset_export
  ON public.manual_reviews (approved_for_dataset_export, reviewed_at DESC)
  WHERE approved_for_dataset_export = TRUE;

-- 4. Keep original model predictions in classification_events strictly immutable
CREATE OR REPLACE FUNCTION public.enforce_classification_prediction_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.image_object_path IS DISTINCT FROM OLD.image_object_path
     OR NEW.predicted_class_id IS DISTINCT FROM OLD.predicted_class_id
     OR NEW.candidate_predictions IS DISTINCT FROM OLD.candidate_predictions
     OR NEW.model_score IS DISTINCT FROM OLD.model_score
     OR NEW.calibrated_confidence IS DISTINCT FROM OLD.calibrated_confidence
     OR NEW.confidence_threshold IS DISTINCT FROM OLD.confidence_threshold
     OR NEW.decision_status IS DISTINCT FROM OLD.decision_status
     OR NEW.recommended_bin_code IS DISTINCT FROM OLD.recommended_bin_code
     OR NEW.model_version_id IS DISTINCT FROM OLD.model_version_id
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Original model predictions and metadata in classification_events are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_classification_events_immutable_predictions ON public.classification_events;
CREATE TRIGGER trg_classification_events_immutable_predictions
  BEFORE UPDATE ON public.classification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_classification_prediction_immutability();

-- Prevent ordinary deletion of classification_events under review
CREATE OR REPLACE FUNCTION public.prevent_uncertain_classification_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.review_status <> 'not_required' THEN
    RAISE EXCEPTION 'Uncertain or reviewed classification events cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_uncertain_classification_delete ON public.classification_events;
CREATE TRIGGER trg_prevent_uncertain_classification_delete
  BEFORE DELETE ON public.classification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_uncertain_classification_deletion();

-- 5. Transactional RPC: Claim a pending manual review (prevents conflicting simultaneous work)
CREATE OR REPLACE FUNCTION public.claim_manual_review(
  p_classification_id UUID,
  p_reviewer_id UUID,
  p_expected_version INTEGER DEFAULT NULL
)
RETURNS public.manual_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_review public.manual_reviews;
  v_before JSONB;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_reviewer_id;
  IF v_role IS NULL OR v_role NOT IN ('reviewer', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only authorised reviewers or admins may claim reviews.';
  END IF;

  SELECT * INTO v_review
  FROM public.manual_reviews
  WHERE classification_id = p_classification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Manual review record not found for classification %.', p_classification_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_review.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLICT: Manual review was modified concurrently (expected version %, current version %).', p_expected_version, v_review.version;
  END IF;

  IF v_review.queue_status IN ('confirmed', 'relabelled') THEN
    RAISE EXCEPTION 'CONFLICT: Classification % has already been resolved (%).', p_classification_id, v_review.queue_status;
  END IF;

  IF v_review.queue_status = 'in_progress' AND v_review.claimed_by IS NOT NULL AND v_review.claimed_by <> p_reviewer_id THEN
    RAISE EXCEPTION 'CONFLICT: Review is currently claimed by another reviewer (%).', v_review.claimed_by;
  END IF;

  v_before := to_jsonb(v_review);

  UPDATE public.manual_reviews
  SET
    queue_status = 'in_progress',
    claimed_by = p_reviewer_id,
    claimed_at = NOW(),
    version = v_review.version + 1
  WHERE id = v_review.id
  RETURNING * INTO v_review;

  UPDATE public.classification_events
  SET review_status = 'in_progress'
  WHERE id = p_classification_id;

  INSERT INTO public.audit_events (
    actor_id,
    event_type,
    entity_type,
    entity_id,
    before_state,
    after_state
  )
  VALUES (
    p_reviewer_id,
    'manual_reviews.claim',
    'manual_reviews',
    v_review.id::text,
    v_before,
    to_jsonb(v_review)
  );

  RETURN v_review;
END;
$$;

-- 6. Transactional RPC: Submit manual review decision with optimistic concurrency & taxonomy validation
CREATE OR REPLACE FUNCTION public.submit_manual_review_decision(
  p_classification_id UUID,
  p_reviewer_id UUID,
  p_action public.manual_review_outcome_enum,
  p_resolved_class_code TEXT,
  p_reviewer_notes TEXT,
  p_expected_version INTEGER DEFAULT NULL,
  p_approved_for_dataset_export BOOLEAN DEFAULT FALSE
)
RETURNS public.manual_reviews
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.app_role;
  v_review public.manual_reviews;
  v_event public.classification_events;
  v_resolved_class_id UUID;
  v_before JSONB;
  v_new_queue_status public.manual_review_queue_status_enum;
  v_new_event_review_status public.classification_review_status_enum;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_reviewer_id;
  IF v_role IS NULL OR v_role NOT IN ('reviewer', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: Only authorised reviewers or admins may submit review decisions.';
  END IF;

  IF p_action IN ('relabelled', 'unresolved') AND char_length(btrim(COALESCE(p_reviewer_notes, ''))) < 3 THEN
    RAISE EXCEPTION 'VALIDATION: A documented reason of at least 3 characters is required for % actions.', p_action;
  END IF;

  IF p_action = 'unresolved' AND p_approved_for_dataset_export THEN
    RAISE EXCEPTION 'VALIDATION: Unresolved classifications cannot be approved for dataset export.';
  END IF;

  SELECT * INTO v_review
  FROM public.manual_reviews
  WHERE classification_id = p_classification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Manual review record not found for classification %.', p_classification_id;
  END IF;

  IF p_expected_version IS NOT NULL AND v_review.version <> p_expected_version THEN
    RAISE EXCEPTION 'CONFLICT: Manual review was updated concurrently (expected version %, current version %).', p_expected_version, v_review.version;
  END IF;

  IF v_review.queue_status = 'in_progress' AND v_review.claimed_by IS NOT NULL AND v_review.claimed_by <> p_reviewer_id THEN
    RAISE EXCEPTION 'CONFLICT: Review is currently claimed by another reviewer (%).', v_review.claimed_by;
  END IF;

  SELECT * INTO v_event
  FROM public.classification_events
  WHERE id = p_classification_id
  FOR UPDATE;

  IF p_action = 'confirmed' THEN
    IF v_event.predicted_class_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION: Cannot confirm a classification event without a predicted taxonomy class.';
    END IF;
    v_resolved_class_id := v_event.predicted_class_id;
    v_new_queue_status := 'confirmed';
    v_new_event_review_status := 'confirmed';
  ELSIF p_action = 'relabelled' THEN
    IF btrim(COALESCE(p_resolved_class_code, '')) = '' THEN
      RAISE EXCEPTION 'VALIDATION: A target taxonomy class is required when relabelling.';
    END IF;
    SELECT id INTO v_resolved_class_id
    FROM public.waste_taxonomy
    WHERE class_code = btrim(p_resolved_class_code)
      AND active = TRUE
    LIMIT 1;

    IF v_resolved_class_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION: Category "%" is not an active approved taxonomy class.', p_resolved_class_code;
    END IF;
    v_new_queue_status := 'relabelled';
    v_new_event_review_status := 'relabelled';
  ELSE
    v_resolved_class_id := NULL;
    v_new_queue_status := 'unresolved';
    v_new_event_review_status := 'unresolved';
  END IF;

  v_before := to_jsonb(v_review);

  UPDATE public.manual_reviews
  SET
    reviewer_id = p_reviewer_id,
    confirmed_class_id = v_resolved_class_id,
    review_outcome = p_action,
    queue_status = v_new_queue_status,
    review_reason = COALESCE(NULLIF(btrim(p_reviewer_notes), ''), 'Confirmed predicted category.'),
    reviewed_at = NOW(),
    claimed_by = p_reviewer_id,
    claimed_at = COALESCE(v_review.claimed_at, NOW()),
    version = v_review.version + 1,
    approved_for_dataset_export = CASE
      WHEN p_action IN ('confirmed', 'relabelled') THEN COALESCE(p_approved_for_dataset_export, FALSE)
      ELSE FALSE
    END,
    dataset_export_approved_by = CASE
      WHEN p_action IN ('confirmed', 'relabelled') AND COALESCE(p_approved_for_dataset_export, FALSE) THEN p_reviewer_id
      ELSE NULL
    END,
    dataset_export_approved_at = CASE
      WHEN p_action IN ('confirmed', 'relabelled') AND COALESCE(p_approved_for_dataset_export, FALSE) THEN NOW()
      ELSE NULL
    END
  WHERE id = v_review.id
  RETURNING * INTO v_review;

  -- Update ONLY review_status; original predicted_class_id, scores, and decision_status remain immutable
  UPDATE public.classification_events
  SET review_status = v_new_event_review_status
  WHERE id = p_classification_id;

  INSERT INTO public.audit_events (
    actor_id,
    event_type,
    entity_type,
    entity_id,
    before_state,
    after_state
  )
  VALUES (
    p_reviewer_id,
    'manual_reviews.decision.' || p_action::text,
    'manual_reviews',
    v_review.id::text,
    v_before,
    to_jsonb(v_review)
  );

  RETURN v_review;
END;
$$;
