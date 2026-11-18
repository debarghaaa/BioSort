# Environment Setup

Secrets must never be committed to source control (`.env*` is ignored in `.gitignore` while `.env.example` templates are tracked).

## 1. Frontend Environment Variables (`/.env.example`)

Public browser variables bundled at build time by Vite:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | Yes (for live API) | HTTPS base URL of the deployed FastAPI inference service (`https://...`) |
| `VITE_SUPABASE_URL` | Yes (for Supabase Auth) | Supabase project HTTPS URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (for Supabase Auth) | Public Supabase `anon` key (protected by RLS) |
| `VITE_SUPABASE_EVIDENCE_BUCKET` | Optional (default `waste-evidence`) | Private storage bucket identifier |

> **Security**: Never place `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` in any `VITE_*` variable.

## 2. Backend Environment Variables (`/services/inference-api/.env.example`)

Server-only variables validated on startup via `Settings.validate_startup_environment()`:

| Variable | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase credential (never exposed to browser) |
| `SUPABASE_JWT_SECRET` | Yes | Supabase Auth JWT HS256 verification secret |
| `SUPABASE_STORAGE_BUCKET` | Yes (default `waste-evidence`) | Private storage bucket name |
| `MODEL_PATH` | Yes | Filesystem path to `.onnx` classifier |
| `CLASS_NAMES_PATH` | Yes | Path to canonical class names JSON |
| `PREPROCESSING_CONFIG_PATH` | Yes | Path to Colab preprocessing manifest JSON |
| `CONFIDENCE_CONFIG_PATH` | Yes | Path to calibration & confidence threshold JSON |
| `MODEL_VERSION` | Yes | Active model identifier matching `model_versions` |
| `ALLOWED_ORIGINS` | Yes | Comma-separated CORS origins (e.g., HTTPS frontend URL) |
