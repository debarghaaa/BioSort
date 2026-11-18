# Deployment Guide

The platform separates the React SPA from the Python ONNX inference service so JavaScript-only web hosts never attempt to run native `onnxruntime` binaries in-process.

## 1. Supabase Database & Storage Setup

1. Create a managed Supabase project.
2. Apply SQL migrations sequentially from `/supabase/migrations/`:
   - `202611170001_core_tables.sql`
   - `202611170002_rls_and_storage.sql`
   - `202611170003_analytics_views.sql`
   - `202611170004_audit_triggers_and_retention.sql`
   - `202611170005_review_workflow_and_audit.sql`
   - `202611170006_analytics_dashboard_and_alerts.sql`
3. Confirm the `waste-evidence` storage bucket has `public = false`.
4. Provision Supabase Auth users and assign `operator`, `reviewer`, or `admin` roles in `public.profiles` and JWT `app_metadata.role`.
5. Register the deployed model identifier in `public.model_versions` matching `MODEL_VERSION`, and populate verified `public.bin_mappings` rows.

## 2. FastAPI + ONNX Runtime Container Deployment

Deploy `/services/inference-api` to any container platform (Cloud Run, Fly.io, ECS, Railway, or VM):

```bash
cd services/inference-api
docker build -t medwaste-inference-api:latest .
docker run -d \
  -p 8000:8000 \
  --env-file .env \
  -v /path/to/exported-artefacts:/app/artefacts:ro \
  medwaste-inference-api:latest
```

Verification checks after container startup:
- `GET https://<api-host>/health` -> HTTP `200` (`{"status": "alive"}`)
- `GET https://<api-host>/ready` -> HTTP `200` (`{"status": "ready", "model_loaded": true, "supabase_connected": true}`)
- Configure `ALLOWED_ORIGINS` strictly to the HTTPS origin of the hosted frontend.

## 3. Frontend Production Deployment

Configure `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in the web hosting environment (HTTPS), then build and serve `dist/`:
```bash
npm ci
npm run lint
npm test
npm run build
```

Verify responsive layout across desktop and mobile viewports and test `/settings` readiness check against `https://<api-host>/ready`.
