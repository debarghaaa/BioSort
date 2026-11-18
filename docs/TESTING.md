# Testing Guide

The platform uses a layered verification strategy across frontend TypeScript, API contracts, FastAPI backend & ML unit tests, and Supabase SQL migration checks.

## 1. Frontend, Contract, Migration & E2E Client Suite (`npm test`)

Executed directly via Node.js (`tsx --test tests/*.test.ts`):
- `tests/contracts.test.ts`: Validates `/contracts/classification.schema.json`, `/contracts/openapi.yaml` route coverage, `SharedClassificationResult` validators, and prohibited term guards (`safe`, `sterile`, `medically approved`).
- `tests/api_client_e2e.test.ts`: Exercises `src/services/api/classificationApi.ts` over real HTTP against an in-process stub server across all 6 end-to-end scenarios:
  1. Successful classification (`accepted`, confidence & verified bin mapping)
  2. Low-confidence classification (`review_required` -> pending review queue)
  3. Missing mapping (`mapping_unconfigured`, `recommended_bin === null`)
  4. Manual review submission (`confirmed` / `relabelled` / `unresolved` -> audit history -> updated analytics & CSV export)
  5. Inference unavailable (`503` `/ready` & `/api/v1/classifications`, zero fabricated predictions)
  6. Persistence unavailable (`502` error propagation)
- `tests/database_migrations.test.ts`: Verifies RLS enablement across all 9 tables, foreign keys, immutability triggers, private storage bucket (`public = FALSE`), hardware-unavailable markers, and absence of `SUPABASE_SERVICE_ROLE_KEY` in `src/`.
- `tests/frontend_auth_and_validation.test.ts`: Validates upload MIME/size/dimension bounds matching FastAPI, formatters, RBAC route guards (`/review`), and Guest Mode isolation.

Commands:
```bash
npm run lint
npm test
npm run build
```

## 2. FastAPI Backend & ML Unit/E2E Suite (`services/inference-api/tests/`)

Run inside a Python 3.11+ environment with `pip install -r services/inference-api/requirements.txt`:
- `test_startup_and_health.py`: `/health` vs `/ready` separation, missing model `503`, class-index mismatch rejection, `/api/v1/models/current`.
- `test_decision_engine.py`: Threshold gating, uncalibrated score rejection, unverified mapping blocking, banned outcome term rejection.
- `test_classification_api.py`: Auth `401`, RBAC `403`, taxonomy validation `422`, optimistic concurrency `409`, spoofed MIME/corrupted/oversized image rejection, storage cleanup on DB failure, analytics dashboard & CSV export.
- `test_ml_preprocessing_and_calibration.py`: `RGB`/`BGR` + `NCHW`/`NHWC` preprocessing parity, temperature & Platt calibration, `MODEL_VERSION` mismatch rejection.
- `test_e2e_workflows.py`: End-to-end `operator` upload -> `reviewer` resolution -> `/analytics/dashboard`, `503` unavailability, and `validate_startup_environment()`.

Commands:
```bash
cd services/inference-api
pytest -v
```

> Note: In JavaScript-only preview containers lacking Python ML wheels (`fastapi`, `onnxruntime`, `pytest`), `python3 -m py_compile` verifies Python syntax while runtime `pytest` execution requires a provisioned Python/Docker environment.
