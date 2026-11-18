# Model Deployment & Colab ONNX Parity Guide

Model development and training happen strictly offline in Google Colab + PyTorch (`/ml/README.md`), completely decoupled from both the React UI and FastAPI runtime inference.

## Required Exported Artefacts

FastAPI loads and validates five explicit settings once at startup:
1. `MODEL_PATH`: Path to the exported `.onnx` model (e.g., MobileNetV3 or EfficientNet logits graph).
2. `CLASS_NAMES_PATH`: JSON array (or `{"class_names": [...]}`) whose length and index order match the ONNX output logits vector (`[1, num_classes]`).
3. `PREPROCESSING_CONFIG_PATH`: JSON specification defining `input_width`, `input_height`, `channel_order` (`RGB` or `BGR`), `tensor_layout` (`NCHW` or `NHWC`), `resize_mode` (`center_crop`, `letterbox`, `direct_resize`), `rescale_factor`, `normalization_mean`, and `normalization_std`.
4. `CONFIDENCE_CONFIG_PATH`: JSON defining `model_version`, `jurisdiction_code`, `accept_threshold`, `review_floor_threshold`, `minimum_margin_over_second`, `require_calibrated_confidence`, and `calibration` (`none`, `temperature_scaling`, `platt_scaling`).
5. `MODEL_VERSION`: Explicit version string (must match `CONFIDENCE_CONFIG_PATH.model_version` if supplied and must exist in PostgreSQL `public.model_versions`).

## Verification Before Promotion

Run `/ml/verify_onnx_export.py` inside the Colab or ML validation environment after exporting from PyTorch:
```bash
python ml/verify_onnx_export.py \
  --onnx-path artefacts/model_v1.onnx \
  --class-names artefacts/class_names.json \
  --preprocessing-config artefacts/preprocessing.json \
  --confidence-config artefacts/confidence.json \
  --expected-model-version mobilenetv3-medical-waste-v1
```

Checks enforced both offline and at FastAPI startup:
- **Numerical Parity**: `max(|pytorch_logits - onnx_logits|) < 1e-4`.
- **Tensor Alignment**: 4D ONNX input matches `tensor_layout`, `input_height`, `input_width`, and 3 channels.
- **Class Index Alignment**: 2D ONNX logits output size matches `len(class_names)`.
- **Version Lock**: `MODEL_VERSION` matches `confidence.json` (`model_version`) and the `model_versions` database record.

If any artefact is missing or misaligned, FastAPI `/ready` returns HTTP `503` and `POST /api/v1/classifications` refuses to emit fake predictions.
