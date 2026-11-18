# Supabase Database Design & Migration Guide

## 1. Relational Model Overview

The PostgreSQL schema separates identity, taxonomy, regulatory bin mapping, model artefact versioning, classification events, manual reviews, and immutable audit logs:

- **`profiles`**: 1:1 extension of `auth.users(id)` storing `display_name` and `role` (`admin | operator | reviewer`). Automatically provisioned via trigger with default `'operator'` role.
- **`waste_taxonomy`**: Canonical classifier classes (`class_code`, `display_name`, `taxonomy_version`, `active`).
- **`bin_mappings`**: Maps a `waste_taxonomy` row to a regulatory `bin_code` and `policy_reference`. Enforces `mapping_status` (`pending | verified | disabled`), requires `verified_by` and `verified_at` when `'verified'`, and restricts at most one `'verified'` mapping per `class_id`.
- **`model_versions`**: Registry of Colab-exported ONNX artefacts (`model_version`, `artifact_path`, `sha256`, `framework`, `input_shape`, `preprocessing_version`, `class_mapping_version`, `metrics`, `deployment_status`).
- **`classification_events`**: Immutable event record linking `created_by`, `image_object_path` (never raw bytes), `predicted_class_id`, `model_score`, `calibrated_confidence`, `confidence_threshold`, `decision_status`, `recommended_bin_code`, `review_status`, `model_version_id`, and `request_id`. Enforces `decision_status = 'accepted' OR recommended_bin_code IS NULL`.
- **`manual_reviews`**: Traceable human review record (`classification_id`, `reviewer_id`, `confirmed_class_id`, `review_outcome`: `confirmed | relabelled | unresolved`, `review_reason`, `reviewed_at`).
- **`audit_events`**: Append-only table protected by a `BEFORE UPDATE OR DELETE` trigger and populated by triggers on `waste_taxonomy`, `bin_mappings`, and `manual_reviews`, as well as backend API inserts.

## 2. Analytics Views & Virtual Bin Assignment Rules

All six analytics views use `WITH (security_invoker = true)` so PostgreSQL enforces caller RLS policies:

1. `daily_classification_counts`
2. `class_distribution`
3. `decision_status_summary`
4. `manual_review_summary`
5. `model_version_usage`
6. `virtual_bin_assignment_counts`

**Virtual Bin Invariants**:
- `virtual_bin_assignment_counts` aggregates `recommended_bin_code` strictly from persisted `classification_events` where `decision_status = 'accepted'`.
- It explicitly returns `physical_sensor_status = 'unavailable'` and `physical_fill_level_pct = NULL`.
- No bin-sensor tables exist, and physical fill levels or capacities are never invented or represented as `0`.

## 3. Applying Migrations

Apply migrations in strict filename order:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or via `psql` in order:
1. `202611170001_core_tables.sql`
2. `202611170002_rls_and_storage.sql`
3. `202611170003_analytics_views.sql`
4. `202611170004_audit_triggers_and_retention.sql`

## 4. Rollback Considerations

- **Forward-only in production**: Because `classification_events` and `audit_events` form a compliance trail, prefer corrective forward migrations over dropping tables in production.
- **Non-destructive staging rollback order** (reverse dependency order):
  1. Drop views from `003` (`DROP VIEW IF EXISTS public.virtual_bin_assignment_counts, ...`).
  2. Drop triggers/functions from `004` (`on_auth_user_created`, `trg_audit_*`).
  3. Drop storage policies & RLS policies from `002`.
  4. Drop tables in reverse FK order (`retention_policies`, `audit_events`, `manual_reviews`, `classification_events`, `model_versions`, `bin_mappings`, `waste_taxonomy`, `profiles`) and enum types.
