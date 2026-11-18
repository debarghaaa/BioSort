# AI Medical Waste Segregation Platform — Software Architecture

## 1. Purpose & Scope Boundaries

The **AI Medical Waste Segregation Platform** is a software-only assistive classification and recordkeeping system. It accepts uploaded medical waste item images, validates and preprocesses them, runs image classification through an external FastAPI + ONNX Runtime service, verifies prediction confidence against explicit policy thresholds, resolves configured regulatory category-to-bin mappings, routes uncertain or unmapped predictions to manual review, and records immutable audit trails.

### Explicit Exclusions
- **No Physical Hardware**: Cameras, USB capture devices, IR/presence/ultrasonic/weight sensors, ESP32/Raspberry Pi/Jetson edge controllers, MQTT telemetry, conveyors, servos, stepper motors, and mechanical bin actuation are strictly excluded.
- **No Patient Identifiers (PHI)**: No patient names, MRNs, or clinical treatment records are collected or stored.
- **Not Handling Authorization**: Outputs are assistive classification suggestions and recordkeeping logs, never authorization to handle or dispose of waste.
- **Prohibited Outcome Terms**: The words `safe`, `sterile`, and `medically approved` are never used as prediction outcomes or bin labels.

## 2. System Topology

```
[ React + Vite + TypeScript UI ]
       |                |
       | (Supabase Auth | (HTTPS multipart image upload / JSON API)
       |  & RLS Queries)|
       v                v
[ Supabase ]     [ Python + FastAPI + ONNX Runtime Service ]
 - PostgreSQL      - Image validation & deterministic preprocessing
 - Private Storage - ONNX Runtime (MobileNetV3 / EfficientNet)
 - Auth (RBAC)     - Policy & Category-to-Bin Decision Engine
                   - Server-side Supabase persistence (service_role)
                        ^
                        | (Versioned .onnx + manifest.json)
                 [ Google Colab + PyTorch Training ]
```

## 3. Component Responsibilities

1. **Frontend (`src/`)**:
   - Presents upload workbench, client-side image validation (MIME, size, resolution, SHA-256), manual review queue, classification history, honest analytics (derived strictly from recorded events), policy/taxonomy configuration, model version registry, and audit viewer.
   - Never executes ML inference in the browser and never holds `SUPABASE_SERVICE_ROLE_KEY`.
2. **Inference & Policy Backend (`services/inference-api/`)**:
   - Separately deployable FastAPI service hosting ONNX Runtime (`CPUExecutionProvider`).
   - Enforces separation between ML inference (`app/inference.py`) and policy evaluation (`app/decision_engine.py`).
   - Returns HTTP `503` if no real `.onnx` artifact is loaded; never fabricates predictions.
3. **Database, Auth & Storage (`supabase/`)**:
   - PostgreSQL tables with strict Row Level Security (`operator`, `reviewer`, `admin`).
   - Private `waste-evidence` Storage bucket (`public = FALSE`).
   - Database check constraints enforce that `recommended_bin` is `NULL` whenever `decision_status != 'accepted'` and that unverified mappings cannot be marked verified without approver metadata.
4. **ML Training Pipeline (`ml/`)**:
   - Offline Google Colab + PyTorch workflow producing `.onnx` models, temperature-scaling calibration metadata, and preprocessing manifests.

## 4. Known Unknowns Represented as Configuration

Because the labelled dataset, exact taxonomy subclasses, jurisdiction-specific regulatory mappings, and validated confidence thresholds have not yet been supplied, the platform models all of them as explicit database/workspace configuration entities (`waste_taxonomy_classes`, `category_bin_mappings`, `confidence_policies`, `model_versions`) rather than hardcoding placeholder statistics.
