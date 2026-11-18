# AI Medical Waste Segregation Platform

Software-only assistive medical waste image classification, confidence verification, regulatory policy routing, human-in-the-loop manual review, and audit monitoring platform.

> **Important Notice**: This software is an assistive classification and recordkeeping platform. Outputs are **not** authorization to handle or dispose of medical waste. The platform collects no patient identifiers (PHI), executes no physical hardware or bin actuation, and never displays fabricated predictions or accuracy claims.

## Repository Structure

```text
/contracts/                 Canonical JSON Schema & OpenAPI 3.1 API specification
/docs/                      Platform architecture, API, DB, model, testing, and deployment docs
/ml/                        Colab + PyTorch ONNX export workflow & parity verifier (verify_onnx_export.py)
/services/inference-api/    Separately deployable Python + FastAPI + ONNX Runtime service (Dockerized)
/src/                       React 19 + Vite + TypeScript frontend application
/supabase/migrations/       PostgreSQL schema, RLS policies, storage bucket, and RPC migrations (0001–0006)
/tests/                     Frontend/contract/E2E/SQL-integrity Node test suite (`npm test`)
```

## Documentation Index

- [Architecture Overview](docs/ARCHITECTURE.md) & ADRs (`docs/adr/`)
- [API Documentation](docs/API_DOCUMENTATION.md)
- [Database & Storage Documentation](docs/DATABASE_DOCUMENTATION.md)
- [Model Deployment & Colab ONNX Parity](docs/MODEL_DEPLOYMENT.md)
- [Environment Setup](docs/ENVIRONMENT_SETUP.md)
- [Testing Guide](docs/TESTING.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Known Limitations & Production Readiness Checklist](docs/KNOWN_LIMITATIONS.md)

## Quick Start

1. **Frontend (React + Vite + TypeScript)**:
   ```bash
   npm install
   cp .env.example .env
   npm run lint
   npm test
   npm run build
   npm run dev
   ```
2. **Supabase PostgreSQL & Private Storage**:
   Apply migrations `supabase/migrations/202611170001_core_tables.sql` through `202611170006_analytics_dashboard_and_alerts.sql` in order. See [DATABASE_DOCUMENTATION.md](docs/DATABASE_DOCUMENTATION.md).
3. **FastAPI + ONNX Runtime Inference Service**:
   Deploy `/services/inference-api` as a Python container or run locally with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. See [DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Production Readiness Status

**NOT PRODUCTION READY** until external ML artefacts, labelled dataset validation, verified jurisdiction bin mappings, and live Python/Supabase integration tests are supplied and verified. See [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) for all mandatory release gates.
