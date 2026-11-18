-- Migration 006: Server-Side Monitoring Analytics Aggregation & Alert Thresholds
-- Strictly software-only: virtual assignment counts only, physical sensor data explicitly
-- marked 'unavailable' (never 0), confidence distinguished from reviewed comparison accuracy.

CREATE TABLE IF NOT EXISTS public.operational_alert_thresholds (
  id TEXT PRIMARY KEY DEFAULT 'default',
  pending_review_backlog_threshold INTEGER NOT NULL DEFAULT 10 CHECK (pending_review_backlog_threshold >= 1),
  classification_failure_threshold INTEGER NOT NULL DEFAULT 3 CHECK (classification_failure_threshold >= 1),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.operational_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read alert thresholds"
  ON public.operational_alert_thresholds FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Admins manage alert thresholds"
  ON public.operational_alert_thresholds FOR ALL
  TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

INSERT INTO public.operational_alert_thresholds (
  id,
  pending_review_backlog_threshold,
  classification_failure_threshold
)
VALUES ('default', 10, 3)
ON CONFLICT (id) DO NOTHING;

-- Server-side aggregation RPC for large datasets without transferring image blobs
CREATE OR REPLACE FUNCTION public.get_monitoring_analytics(
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_decision_status public.decision_status_enum DEFAULT NULL,
  p_model_version TEXT DEFAULT NULL,
  p_review_status public.classification_review_status_enum DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_accepted BIGINT;
  v_review_required BIGINT;
  v_mapping_unconfigured BIGINT;
  v_rejected BIGINT;
  v_avg_model_score NUMERIC;
  v_avg_calibrated NUMERIC;
  v_calibrated_count BIGINT;
  v_total_reviews BIGINT;
  v_resolved_reviews BIGINT;
  v_pending_queue BIGINT;
  v_confirmed_comp BIGINT;
  v_relabelled_comp BIGINT;
  v_failures BIGINT;
  v_thresholds RECORD;
  v_volume JSONB;
  v_class_dist JSONB;
  v_decision_dist JSONB;
  v_conf_hist JSONB;
  v_review_trends JSONB;
  v_model_comp JSONB;
  v_virtual_bins JSONB;
  v_unmapped JSONB;
BEGIN
  SELECT * INTO v_thresholds
  FROM public.operational_alert_thresholds
  WHERE id = 'default';

  -- Filtered classification_events CTE materialized for consistent metrics
  CREATE TEMP TABLE IF NOT EXISTS _filtered_events ON COMMIT DROP AS
  SELECT
    ce.id,
    ce.created_at,
    ce.decision_status,
    ce.review_status,
    ce.recommended_bin_code,
    ce.model_score,
    ce.calibrated_confidence,
    wt.class_code AS predicted_class,
    wt.display_name AS predicted_display_name,
    mv.model_version,
    mv.framework,
    mv.deployment_status,
    mv.preprocessing_version,
    mv.metrics AS training_metrics
  FROM public.classification_events ce
  LEFT JOIN public.waste_taxonomy wt ON wt.id = ce.predicted_class_id
  JOIN public.model_versions mv ON mv.id = ce.model_version_id
  WHERE (p_date_from IS NULL OR ce.created_at >= p_date_from::timestamptz)
    AND (p_date_to IS NULL OR ce.created_at < (p_date_to + 1)::timestamptz)
    AND (p_category IS NULL OR btrim(p_category) = '' OR wt.class_code = btrim(p_category))
    AND (p_decision_status IS NULL OR ce.decision_status = p_decision_status)
    AND (p_model_version IS NULL OR btrim(p_model_version) = '' OR mv.model_version = btrim(p_model_version))
    AND (p_review_status IS NULL OR ce.review_status = p_review_status);

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE decision_status = 'accepted'),
    COUNT(*) FILTER (WHERE review_status IN ('pending', 'in_progress')),
    COUNT(*) FILTER (WHERE decision_status = 'mapping_unconfigured'),
    COUNT(*) FILTER (WHERE decision_status = 'rejected'),
    AVG(model_score),
    AVG(calibrated_confidence) FILTER (WHERE calibrated_confidence IS NOT NULL),
    COUNT(*) FILTER (WHERE calibrated_confidence IS NOT NULL)
  INTO
    v_total,
    v_accepted,
    v_review_required,
    v_mapping_unconfigured,
    v_rejected,
    v_avg_model_score,
    v_avg_calibrated,
    v_calibrated_count
  FROM _filtered_events;

  -- Review queue backlog (authoritative global pending/in_progress count matching /review)
  SELECT COUNT(*)
  INTO v_pending_queue
  FROM public.manual_reviews mr
  WHERE mr.queue_status IN ('pending', 'in_progress');

  -- Review resolution rate & reviewed agreement subset within filtered events
  SELECT
    COUNT(mr.id),
    COUNT(mr.id) FILTER (WHERE mr.queue_status IN ('confirmed', 'relabelled', 'unresolved') AND mr.reviewed_at IS NOT NULL),
    COUNT(mr.id) FILTER (WHERE mr.queue_status = 'confirmed'),
    COUNT(mr.id) FILTER (WHERE mr.queue_status = 'relabelled')
  INTO
    v_total_reviews,
    v_resolved_reviews,
    v_confirmed_comp,
    v_relabelled_comp
  FROM public.manual_reviews mr
  JOIN _filtered_events fe ON fe.id = mr.classification_id;

  -- Classification volume over time
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.date ASC), '[]'::jsonb)
  INTO v_volume
  FROM (
    SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE decision_status = 'accepted') AS accepted,
      COUNT(*) FILTER (WHERE decision_status = 'review_required') AS review_required,
      COUNT(*) FILTER (WHERE decision_status = 'mapping_unconfigured') AS mapping_unconfigured,
      COUNT(*) FILTER (WHERE decision_status = 'rejected') AS rejected
    FROM _filtered_events
    GROUP BY 1
  ) t;

  -- Predicted class distribution
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_class_dist
  FROM (
    SELECT
      COALESCE(predicted_class, 'unassigned') AS class_code,
      COALESCE(predicted_display_name, 'Unassigned') AS display_name,
      COUNT(*) AS count,
      COUNT(*) FILTER (WHERE decision_status = 'accepted') AS accepted_count,
      CASE WHEN v_total > 0 THEN ROUND((COUNT(*)::numeric / v_total) * 100, 2) ELSE 0 END AS percentage
    FROM _filtered_events
    GROUP BY 1, 2
  ) t;

  -- Decision status distribution
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_decision_dist
  FROM (
    SELECT
      s.status::text AS status,
      COUNT(fe.id) AS count,
      CASE WHEN v_total > 0 THEN ROUND((COUNT(fe.id)::numeric / v_total) * 100, 2) ELSE 0 END AS percentage
    FROM unnest(ARRAY['accepted', 'review_required', 'mapping_unconfigured', 'rejected']::public.decision_status_enum[]) AS s(status)
    LEFT JOIN _filtered_events fe ON fe.decision_status = s.status
    GROUP BY s.status
  ) t;

  -- Confidence histogram (10 bins using calibrated_confidence when available)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.bin_index ASC), '[]'::jsonb)
  INTO v_conf_hist
  FROM (
    SELECT
      b.idx AS bin_index,
      format('%.1f–%.1f', b.idx * 0.1, (b.idx + 1) * 0.1) AS label,
      COUNT(fe.id) AS count
    FROM generate_series(0, 9) AS b(idx)
    LEFT JOIN _filtered_events fe
      ON fe.calibrated_confidence IS NOT NULL
      AND LEAST(9, GREATEST(0, FLOOR(fe.calibrated_confidence * 10)::int)) = b.idx
    GROUP BY b.idx
  ) t;

  -- Manual review trends over time
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.date ASC), '[]'::jsonb)
  INTO v_review_trends
  FROM (
    SELECT
      to_char(date_trunc('day', mr.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COUNT(*) AS queued,
      COUNT(*) FILTER (WHERE mr.queue_status = 'confirmed') AS confirmed,
      COUNT(*) FILTER (WHERE mr.queue_status = 'relabelled') AS relabelled,
      COUNT(*) FILTER (WHERE mr.queue_status = 'unresolved' AND mr.reviewed_at IS NOT NULL) AS unresolved
    FROM public.manual_reviews mr
    JOIN _filtered_events fe ON fe.id = mr.classification_id
    GROUP BY 1
  ) t;

  -- Model version comparison
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.total_classifications DESC), '[]'::jsonb)
  INTO v_model_comp
  FROM (
    SELECT
      mv.model_version,
      mv.framework,
      mv.deployment_status::text AS deployment_status,
      mv.preprocessing_version,
      COUNT(fe.id) AS total_classifications,
      COUNT(fe.id) FILTER (WHERE fe.decision_status = 'accepted') AS accepted_count,
      COUNT(fe.id) FILTER (WHERE fe.review_status IN ('pending', 'in_progress')) AS review_required_count,
      ROUND(AVG(fe.model_score)::numeric, 4) AS average_model_score,
      mv.metrics AS training_eval_metrics
    FROM public.model_versions mv
    LEFT JOIN _filtered_events fe ON fe.model_version = mv.model_version
    GROUP BY mv.id, mv.model_version, mv.framework, mv.deployment_status, mv.preprocessing_version, mv.metrics
  ) t;

  -- Virtual bin assignments (hardware explicitly unavailable)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.virtual_assignment_count DESC), '[]'::jsonb)
  INTO v_virtual_bins
  FROM (
    SELECT
      recommended_bin_code AS bin_code,
      COUNT(*) AS virtual_assignment_count,
      CASE WHEN v_accepted > 0 THEN ROUND((COUNT(*)::numeric / v_accepted) * 100, 2) ELSE 0 END AS percentage,
      MAX(created_at) AS last_assigned_at,
      'unavailable'::text AS physical_sensor_status,
      NULL::numeric AS physical_fill_level_pct
    FROM _filtered_events
    WHERE decision_status = 'accepted' AND recommended_bin_code IS NOT NULL
    GROUP BY recommended_bin_code
  ) t;

  -- Active taxonomy categories lacking a verified mapping
  SELECT COALESCE(jsonb_agg(wt.class_code ORDER BY wt.class_code), '[]'::jsonb)
  INTO v_unmapped
  FROM public.waste_taxonomy wt
  WHERE wt.active = TRUE
    AND NOT EXISTS (
      SELECT 1 FROM public.bin_mappings bm
      WHERE bm.class_id = wt.id AND bm.mapping_status = 'verified'
    );

  -- Recorded failure events (audit failure entries + rejected classifications in period)
  SELECT
    (SELECT COUNT(*) FROM public.audit_events ae
     WHERE ae.event_type ILIKE '%failure%'
       AND (p_date_from IS NULL OR ae.created_at >= p_date_from::timestamptz)
       AND (p_date_to IS NULL OR ae.created_at < (p_date_to + 1)::timestamptz))
    + v_rejected
  INTO v_failures;

  DROP TABLE IF EXISTS _filtered_events;

  RETURN jsonb_build_object(
    'total_classifications', v_total,
    'accepted_predictions', v_accepted,
    'review_required', v_review_required,
    'unconfigured_mappings', v_mapping_unconfigured,
    'rejected_inputs', v_rejected,
    'average_model_score', ROUND(v_avg_model_score::numeric, 4),
    'average_calibrated_confidence', ROUND(v_avg_calibrated::numeric, 4),
    'calibrated_sample_count', v_calibrated_count,
    'total_review_records', v_total_reviews,
    'resolved_review_count', v_resolved_reviews,
    'review_resolution_rate', CASE WHEN v_total_reviews > 0 THEN ROUND((v_resolved_reviews::numeric / v_total_reviews) * 100, 2) ELSE NULL END,
    'pending_queue_backlog', v_pending_queue,
    'reviewed_comparison', jsonb_build_object(
      'comparison_sample_count', v_confirmed_comp + v_relabelled_comp,
      'confirmed_count', v_confirmed_comp,
      'relabelled_count', v_relabelled_comp,
      'agreement_rate_pct', CASE WHEN (v_confirmed_comp + v_relabelled_comp) > 0 THEN ROUND((v_confirmed_comp::numeric / (v_confirmed_comp + v_relabelled_comp)) * 100, 2) ELSE NULL END
    ),
    'classification_volume_over_time', v_volume,
    'classification_distribution', v_class_dist,
    'decision_status_distribution', v_decision_dist,
    'confidence_distribution', v_conf_hist,
    'manual_review_trends', v_review_trends,
    'model_version_comparison', v_model_comp,
    'virtual_bin_assignments', v_virtual_bins,
    'unmapped_categories', v_unmapped,
    'failure_event_count', v_failures,
    'thresholds', jsonb_build_object(
      'pending_review_backlog_threshold', COALESCE(v_thresholds.pending_review_backlog_threshold, 10),
      'classification_failure_threshold', COALESCE(v_thresholds.classification_failure_threshold, 3)
    )
  );
END;
$$;
