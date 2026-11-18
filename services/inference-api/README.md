# FastAPI + ONNX Runtime Inference Service

Separately deployable Python backend responsible for:
1. Loading Colab-exported ONNX model & artefact configs once at startup (`MODEL_PATH`, `CLASS_NAMES_PATH`, `PREPROCESSING_CONFIG_PATH`, `CONFIDENCE_CONFIG_PATH`, `MODEL_VERSION`)
2. Separating application liveness (`GET /health`) from model & integration readiness (`GET /ready`)
3. Safe temporary-file image upload handling, MIME & binary encoding verification (`JPEG`, `JPG`, `PNG`), and deterministic Colab-parity preprocessing
4. CPU ONNX Runtime inference, ranked predictions, and explicit confidence calibration
5. Deterministic category-to-bin policy routing (`accepted`, `review_required`, `mapping_unconfigured`, `rejected`)
6. Supabase Auth JWT verification + RBAC role checks (`operator`, `reviewer`, `admin`)
7. Private Supabase Storage evidence upload and PostgreSQL persistence with compensating cleanup on failures

## Local Execution

```bash
cd services/inference-api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Running Tests

```bash
cd services/inference-api
pytest -v
```
