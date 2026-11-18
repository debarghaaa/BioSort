# ML Training & ONNX Export Workflow (Google Colab + PyTorch)

Model training is strictly separated from both the React frontend and the FastAPI runtime service.

## Scope & Reference Rules

- **Architectures**: `MobileNetV3` or `EfficientNet` trained in PyTorch on a validated medical waste image dataset.
- **Reference Engineering Practices**: Use `MLpipeline_LungtaV1.ipynb` **only** as a structural reference for:
  1. Reproducible ML experimentation & seed locking
  2. Artifact persistence & explicit versioning
  3. ONNX export & PyTorch-vs-ONNX numerical parity verification
  4. Manifest packaging & acceptance checks
- **Explicit Exclusion**: Do **NOT** reuse Lungta datasets, trained weights, feature definitions, clinical regression models, or cognitive scoring logic.

## Required Export Artifacts

Every trained model release must publish two versioned artifacts consumed by `/services/inference-api`:

1. `model_<version>.onnx` (exported PyTorch classification graph producing raw logits)
2. `manifest_<version>.json`:

```json
{
  "model_version": "mobilenetv3_medical_waste_v0_1_0",
  "architecture": "mobilenetv3",
  "class_names": ["<supplied_taxonomy_class_1>", "<supplied_taxonomy_class_2>"],
  "temperature_scaling": 1.0,
  "preprocessing_spec": {
    "input_width": 224,
    "input_height": 224,
    "channel_order": "RGB",
    "resize_mode": "center_crop",
    "normalization_mean": [0.485, 0.456, 0.406],
    "normalization_std": [0.229, 0.224, 0.225]
  }
}
```

## Calibration & Parity Checklist

- Verify `max(abs(pytorch_logits - onnx_logits)) < 1e-4` across held-out validation samples before registering the model version in Supabase `model_versions`.
- Fit post-hoc calibration (e.g., temperature scaling) on a held-out calibration split so `calibrated_confidence` can be audited separately from raw `model_score`.
- Never equate confidence scores with classification accuracy.
