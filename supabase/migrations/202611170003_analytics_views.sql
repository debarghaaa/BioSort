-- Migration 003: Analytics Views & Virtual Bin Assignment Counts
-- All views use security_invoker = true so RLS on underlying tables is enforced.
-- Virtual bin counts derive strictly from saved classification_events and NEVER
-- claim physical bin contents, fill levels, or sensor availability.

-- 1. daily_classification_counts
CREATE OR REPLACE VIEW public.daily_classification_counts
WITH (security_invoker = true) AS
SELECT
  date_trunc('day', ce.created_at)::date AS classification_date,
  COUNT(*)::bigint AS total_events,
  COUNT(*) FILTER (WHERE ce.decision_status = 'accepted')::bigint AS accepted_count,
  COUNT(*) FILTER (WHERE ce.decision_status = 'review_required')::bigint AS review_required_count,
  COUNT(*) FILTER (WHERE ce.decision_status = 'mapping_unconfigured')::bigint AS mapping_unconfigured_count,
  COUNT(*) FILTER (WHERE ce.decision_status = 'rejected')::bigint AS rejected_count
FROM public.classification_events ce
GROUP BY 1
ORDER BY 1 DESC;

-- 2. class_distribution
CREATE OR REPLACE VIEW public.class_distribution
WITH (security_invoker = true) AS
SELECT
  wt.id AS class_id,
  wt.class_code,
  wt.display_name,
  COUNT(ce.id)::bigint AS event_count,
  COUNT(*) FILTER (WHERE ce.decision_status = 'accepted')::bigint AS accepted_count
FROM public.waste_taxonomy wt
LEFT JOIN public.classification_events ce
  ON ce.predicted_class_id = wt.id
GROUP BY wt.id, wt.class_code, wt.display_name
ORDER BY event_count DESC, wt.class_code ASC;

-- 3. decision_status_summary
CREATE OR REPLACE VIEW public.decision_status_summary
WITH (security_invoker = true) AS
SELECT
  ce.decision_status,
  COUNT(*)::bigint AS event_count
FROM public.classification_events ce
GROUP BY ce.decision_status
ORDER BY event_count DESC;

-- 4. manual_review_summary
CREATE OR REPLACE VIEW public.manual_review_summary
WITH (security_invoker = true) AS
SELECT
  mr.review_outcome,
  COUNT(*)::bigint AS review_count,
  COUNT(*) FILTER (WHERE mr.reviewed_at IS NOT NULL)::bigint AS completed_count,
  COUNT(*) FILTER (WHERE mr.reviewed_at IS NULL)::bigint AS pending_count
FROM public.manual_reviews mr
GROUP BY mr.review_outcome;

-- 5. model_version_usage
CREATE OR REPLACE VIEW public.model_version_usage
WITH (security_invoker = true) AS
SELECT
  mv.id AS model_version_id,
  mv.model_version,
  mv.framework,
  mv.deployment_status,
  COUNT(ce.id)::bigint AS classification_count,
  MAX(ce.created_at) AS last_used_at
FROM public.model_versions mv
LEFT JOIN public.classification_events ce
  ON ce.model_version_id = mv.id
GROUP BY mv.id, mv.model_version, mv.framework, mv.deployment_status
ORDER BY classification_count DESC, mv.created_at DESC;

-- 6. virtual_bin_assignment_counts
-- Derived strictly from accepted classification events.
-- Physical bin fill-level and sensor readings are explicitly unavailable (NULL / 'unavailable').
CREATE OR REPLACE VIEW public.virtual_bin_assignment_counts
WITH (security_invoker = true) AS
SELECT
  ce.recommended_bin_code AS bin_code,
  COUNT(*)::bigint AS virtual_assignment_count,
  MAX(ce.created_at) AS last_assigned_at,
  'unavailable'::text AS physical_sensor_status,
  NULL::numeric AS physical_fill_level_pct
FROM public.classification_events ce
WHERE ce.decision_status = 'accepted'
  AND ce.recommended_bin_code IS NOT NULL
GROUP BY ce.recommended_bin_code
ORDER BY virtual_assignment_count DESC, ce.recommended_bin_code ASC;
