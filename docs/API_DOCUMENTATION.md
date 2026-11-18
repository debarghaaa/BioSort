# API Documentation — FastAPI Inference & Policy Service

All business endpoints live under `/services/inference-api` and are formally specified in `/contracts/openapi.yaml` and `/contracts/classification.schema.json`.

## Authentication & RBAC

Protected endpoints under `/api/v1/*` require a valid Supabase Auth HS256 JWT in the `Authorization: Bearer <token>` header.
- Verified server-side against `SUPABASE_JWT_SECRET` (`audience: "authenticated"`, required claims `sub`, `exp`).
- Application roles (`operator`, `reviewer`, `admin`) are extracted from JWT claims and enforced per route.
- **Guest Mode Notice**: Browser Guest Mode grants UI navigation access only (`accessToken === null`). Protected FastAPI endpoints reject unauthenticated calls with `401 Unauthorized`.

## Health & Readiness Probes

| Endpoint | Auth | Success Status | Purpose |
|---|---|---|---|
| `GET /health` | Public | `200` | Application liveness only (`{"status": "alive"}`). Does **not** require ONNX artefacts or DB. |
| `GET /ready` | Public | `200` / `503` | Verifies ONNX session load, artefact alignment, `MODEL_VERSION`, `SUPABASE_JWT_SECRET`, `ALLOWED_ORIGINS`, and PostgreSQL connectivity. |

## Classification Endpoints

### `POST /api/v1/classifications`
- **Roles**: `operator`, `reviewer`, `admin`
- **Request**: `multipart/form-data` with `file` (`image/jpeg`, `image/png`, `64x64`–`8192x8192`, max `10 MiB`) and optional `jurisdiction_code`.
- **Response (`SharedClassificationResult`)**:
  ```json
  {
    "classification_id": "uuid",
    "predicted_class": "sharps_needle",
    "candidate_predictions": [
      {"class_name": "sharps_needle", "model_score": 0.94, "calibrated_confidence": 0.91}
    ],
    "model_version": "mobilenetv3-...",
    "decision_status": "accepted | review_required | mapping_unconfigured | rejected",
    "recommended_bin": "BIN-SHARPS-01 — ...",
    "requires_manual_review": false,
    "review_reason": null,
    "created_at": "2026-11-17T23:00:00Z"
  }
  ```
- **Failure Modes**:
  - `401` missing/expired JWT; `403` insufficient role; `413` oversized payload; `415` invalid MIME/magic bytes; `400` corrupted/undersized image.
  - `503` ONNX model unavailable (never fabricates predictions).
  - `502` Supabase Storage or PostgreSQL failure (performs compensating delete of uploaded storage object on DB insert failure and never claims persistence succeeded).

### `GET /api/v1/classifications` & `GET /api/v1/classifications/{classification_id}`
- **Roles**: any authenticated user (`operator`, `reviewer`, `admin`).
- **Filters**: `decision_status`, `requires_manual_review`, `category`, `model_version`, `review_status`, `date_from`, `date_to`, `limit`, `offset`.

## Model & Configuration Endpoints

- `GET /api/v1/models/current`: Returns loaded `model_version`, ONNX `input_name`, `input_shape`, `output_name`, `class_names`, `preprocessing`, and `confidence_calibration` (or `503` if model unready).
- `GET /api/v1/bin-mappings`: Lists category-to-bin regulatory mappings (with optional `jurisdiction_code`).

## Manual Review Endpoints

- `GET /api/v1/reviews`: Paginated review queue filtered by `status` (`pending`, `in_progress`, `confirmed`, `relabelled`, `unresolved`), `predicted_category`, `model_version`, `review_reason`, `date_from`, `date_to`, and sorted (`oldest_first`, `newest_first`, `lowest_confidence_first`).
- `GET /api/v1/reviews/{classification_id}`: Full review detail with signed short-TTL image URL (`waste-evidence`) and append-only `review_history`.
- `POST /api/v1/reviews/{classification_id}/claim`: Optimistic lock claim (`expected_version`, returns `409 Conflict` on stale version).
- `POST /api/v1/reviews/{classification_id}`: (`reviewer`, `admin` only) Submit `confirmed`, `relabelled` (must belong to active `waste_taxonomy`), or `unresolved` with `reviewer_notes` and optional `approved_for_dataset_export`.
- `GET /api/v1/reviews/taxonomy`: Active canonical taxonomy classes allowed for relabelling.
- `GET /api/v1/reviews/export/dataset-feedback`: Approved reviewer-verified records for offline Colab retraining.

## Monitoring & Analytics Endpoints

- `GET /api/v1/analytics/summary`: Baseline counts from PostgreSQL summary views.
- `GET /api/v1/analytics/dashboard`: Server-side `get_monitoring_analytics` RPC aggregations (6 KPI metrics, 6 visualization series, virtual bin assignment counts with `physical_sensor_status: "unavailable"`, reviewed agreement subset, and operational alerts).
- `GET /api/v1/analytics/alerts/config` & `PUT /api/v1/analytics/alerts/config` (`admin` only): Read/update `pending_review_backlog_threshold` and `classification_failure_threshold`.
- `GET /api/v1/analytics/export`: Streams filtered CSV (`classification_history`, `analytics_summary`, `model_usage`, `manual_review`, `category_distribution`).
