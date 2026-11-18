# ADR-0001: Decoupled Software-Only Platform Architecture

- **Status**: Accepted
- **Date**: 2026-11-17

## Context

The AI Medical Waste Segregation Platform requires computer vision inference (`MobileNetV3` / `EfficientNet` via ONNX), persistent audit recordkeeping, private image evidence storage, and role-based access control while running the user interface on a Node/Vite web hosting builder that does not execute Python runtimes directly.

## Decision

1. **React + Vite + TypeScript Frontend**: Serves the clinical operator, reviewer, and administrator interface without bundling ML runtimes or service-role secrets.
2. **Separately Deployable Python + FastAPI + ONNX Runtime Service**: Placed in `/services/inference-api` with its own `Dockerfile` and `requirements.txt` so it can be deployed to any container host (Cloud Run, Fly.io, ECS, etc.) and referenced via `VITE_INFERENCE_API_URL`.
3. **Supabase (PostgreSQL + Auth + Private Storage)**: Placed in `/supabase/migrations` as the canonical source of persistent records, RBAC roles, and private evidence objects.
4. **Separate Google Colab PyTorch Training Workflow**: Documented in `/ml/README.md` with strict parity checks, explicitly excluding any reuse of Lungta datasets or clinical regression scoring.

## Consequences

- The AI Studio web container builds and runs the React SPA cleanly while remaining honest when `VITE_INFERENCE_API_URL` or `VITE_SUPABASE_URL` are not yet provisioned.
- No alternative backend (e.g., Convex or SQLite) is substituted for Supabase/FastAPI.
