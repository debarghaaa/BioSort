# Known Limitations & Production Readiness Checklist

## Mandatory Production Readiness Conditions

This platform must **NOT** be declared production-ready until every condition below is independently satisfied and documented:

| # | Condition | Current Status |
|---|---|---|
| 1 | An actual labelled medical waste dataset has been supplied and audited | **Pending External Supply** |
| 2 | MobileNetV3 / EfficientNet classifier trained and evaluated on held-out test data | **Pending External Training** |
| 3 | Confidence thresholds & calibration parameters have documented validation rationale | **Pending Clinical/ML Validation** |
| 4 | Category-to-bin mappings verified against applicable facility regulatory policy (`verified`) | **Pending Facility Sign-off** |
| 5 | ONNX export numerical parity (`< 1e-4`) and FastAPI `pytest` suite executed against live Python runtime | **Pending Live Python Run** |
| 6 | Supabase PostgreSQL migrations, RLS policies, and role isolation tested against live project | **Pending Live Supabase Run** |
| 7 | Private `waste-evidence` image storage verified non-public with signed URLs | Implemented in SQL (`public = FALSE`); verify live bucket |
| 8 | Manual review workflow operational with audit trail | Implemented across SQL, FastAPI, and `/review` UI |
| 9 | Zero hardware-dependent features represented as operational | Verified: physical sensors explicitly marked `Unavailable` |
| 10 | Zero fabricated accuracy or performance figures displayed | Verified: reviewed agreement warns on `n < 30` and separates confidence from accuracy |

## Technical & Runtime Limitations

1. **JS-Only Hosting Boundary**: Interactive frontend preview environments running Node.js/Vite cannot execute Python `uvicorn` or native `onnxruntime` wheels locally; `/services/inference-api` must be deployed as a separate container service.
2. **Guest Mode vs Authenticated API Calls**: Guest mode allows full UI inspection without sign-in (`accessToken === null`), so live authenticated FastAPI endpoints return `401 Unauthorized` until an operator signs in via Supabase Auth.
3. **Software-Only Scope**: No physical bin fill-level telemetry, camera streaming hardware, or robotic sorting actuators are supported; manual bin status notes remain human-entered text logs only.
4. **Python Test Execution in JS Preview**: In this container, `npm run lint`, `npm test`, `npm run build`, and `python3 -m py_compile` execute cleanly, whereas `pytest` requires installing `/services/inference-api/requirements.txt` in a Python runtime.
