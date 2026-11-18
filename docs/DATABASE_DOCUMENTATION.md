# Database & Storage Documentation (Supabase PostgreSQL)

All database schema changes are versioned in `/supabase/migrations/` and typed in `/src/contracts/database_types.ts`.

## Migration Sequence

1. `202611170001_core_tables.sql`: Core enum types (`app_role`, `mapping_status_enum`, `decision_status_enum`, `classification_review_status_enum`, `manual_review_outcome_enum`, `model_deployment_status_enum`) and tables (`profiles`, `waste_taxonomy`, `bin_mappings`, `model_versions`, `classification_events`, `manual_reviews`, `audit_events`, `retention_policies`) plus integrity check constraints (such as disallowing `recommended_bin` when `decision_status <> 'accepted'`).
2. `202611170002_rls_and_storage.sql`: Enables Row Level Security (`ENABLE ROW LEVEL SECURITY`) on all operational tables, enforces role-scoped policies (`operator`, `reviewer`, `admin`), provisions the private `waste-evidence` Storage bucket (`public = FALSE`, `10 MiB` limit, `image/jpeg` & `image/png` only), and restricts `storage.objects` reads/writes via signed URLs.
3. `202611170003_analytics_views.sql`: Read views (`daily_classification_counts`, `class_distribution`, `decision_status_summary`, `manual_review_summary`, `model_version_usage`, `virtual_bin_assignment_counts` explicitly setting `physical_sensor_status = 'unavailable'` and `physical_fill_level_pct = NULL`).
4. `202611170004_audit_triggers_and_retention.sql`: Immutability trigger `prevent_audit_events_mutation()` rejecting `UPDATE`/`DELETE` on `audit_events`, plus `list_expired_evidence_paths()`.
5. `202611170005_review_workflow_and_audit.sql`: Adds optimistic concurrency (`version`), review claiming, `enforce_classification_prediction_immutability()` preventing modification of original model predictions, `claim_manual_review(...)`, `submit_manual_review_decision(...)`, and approved dataset feedback export columns.
6. `202611170006_analytics_dashboard_and_alerts.sql`: Creates `operational_alert_thresholds` table (with RLS) and `get_monitoring_analytics(...)` RPC performing server-side date/category/decision/model/review aggregations without transferring image payloads.

## Security & Privacy Rules

- **Private Image Storage**: Images live exclusively in `waste-evidence` (`public = FALSE`). PostgreSQL stores only `image_object_path` references and metadata.
- **No Patient Identifiers (PHI)**: No patient names, medical record numbers, or clinical treatment columns exist anywhere in the schema.
- **Role Access Matrix**:
  - `operator`: insert/read own `classification_events`; read taxonomy, mappings, models, and analytics.
  - `reviewer`: all `operator` permissions + read all `classification_events`, claim/resolve `manual_reviews`, read `audit_events`.
  - `admin`: all `reviewer` permissions + manage `waste_taxonomy`, `bin_mappings`, `model_versions`, `retention_policies`, and `operational_alert_thresholds`.
- **Service Role Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is restricted exclusively to the FastAPI backend container.
