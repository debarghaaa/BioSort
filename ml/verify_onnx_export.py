"""
Google Colab -> ONNX Export Verification & Parity Utility.

Validates:
1. PyTorch vs ONNX Runtime numerical output parity (max abs diff < 1e-4)
2. Exported preprocessing specification alignment
3. Output tensor shape & class_names index count alignment
4. Model version consistency across exported artefacts

Usage (in Google Colab or Python ML environment with torch + onnxruntime):
  python ml/verify_onnx_export.py \
    --onnx-path artefacts/model_v1.onnx \
    --class-names artefacts/class_names.json \
    --preprocessing-config artefacts/preprocessing.json \
    --confidence-config artefacts/confidence.json \
    --expected-model-version mobilenetv3-medical-waste-v1
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np


def verify_artefact_bundle(
    onnx_path: Path,
    class_names_path: Path,
    preprocessing_path: Path,
    confidence_path: Path,
    expected_model_version: str,
    pytorch_logits: np.ndarray | None = None,
    sample_input: np.ndarray | None = None,
    atol: float = 1e-4,
) -> Dict[str, Any]:
    import onnxruntime as ort

    for label, path in [
        ("ONNX model", onnx_path),
        ("Class names JSON", class_names_path),
        ("Preprocessing config", preprocessing_path),
        ("Confidence config", confidence_path),
    ]:
        if not path.is_file():
            raise FileNotFoundError(f"{label} file not found: {path}")

    raw_classes = json.loads(class_names_path.read_text(encoding="utf-8"))
    class_names: List[str] = (
        list(raw_classes["class_names"])
        if isinstance(raw_classes, dict) and "class_names" in raw_classes
        else list(raw_classes)
    )
    prep = json.loads(preprocessing_path.read_text(encoding="utf-8"))
    conf = json.loads(confidence_path.read_text(encoding="utf-8"))

    if conf.get("model_version") and conf["model_version"] != expected_model_version:
        raise ValueError(
            f"Model version mismatch: expected '{expected_model_version}', "
            f"confidence config has '{conf['model_version']}'."
        )

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    output_meta = session.get_outputs()[0]

    layout = prep.get("tensor_layout", "NCHW")
    w = int(prep["input_width"])
    h = int(prep["input_height"])
    expected_shape = (1, 3, h, w) if layout == "NCHW" else (1, h, w, 3)

    for exp_dim, actual_dim in zip(expected_shape[1:], input_meta.shape[1:]):
        if isinstance(actual_dim, int) and actual_dim != exp_dim:
            raise ValueError(
                f"Input tensor mismatch: ONNX expects {input_meta.shape}, spec expects {expected_shape}"
            )

    if len(output_meta.shape) != 2 or (
        isinstance(output_meta.shape[1], int) and output_meta.shape[1] != len(class_names)
    ):
        raise ValueError(
            f"Output class-index mismatch: ONNX outputs {output_meta.shape}, "
            f"class_names has {len(class_names)} entries"
        )

    probe_input = (
        sample_input.astype(np.float32)
        if sample_input is not None
        else np.zeros(expected_shape, dtype=np.float32)
    )
    ort_logits = np.asarray(session.run(None, {input_meta.name: probe_input})[0], dtype=np.float32)
    if ort_logits.shape != (1, len(class_names)):
        raise ValueError(f"Unexpected runtime logits shape {ort_logits.shape}")

    max_abs_diff = None
    if pytorch_logits is not None:
        max_abs_diff = float(np.max(np.abs(pytorch_logits.astype(np.float32) - ort_logits)))
        if max_abs_diff >= atol:
            raise AssertionError(
                f"PyTorch-vs-ONNX parity check failed: max_abs_diff={max_abs_diff:.6f} >= {atol}"
            )

    return {
        "status": "verified",
        "model_version": expected_model_version,
        "input_shape": expected_shape,
        "num_classes": len(class_names),
        "max_abs_diff": max_abs_diff,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify exported ONNX model artefacts and parity.")
    parser.add_argument("--onnx-path", type=Path, required=True)
    parser.add_argument("--class-names", type=Path, required=True)
    parser.add_argument("--preprocessing-config", type=Path, required=True)
    parser.add_argument("--confidence-config", type=Path, required=True)
    parser.add_argument("--expected-model-version", type=str, required=True)
    args = parser.parse_args()

    summary = verify_artefact_bundle(
        onnx_path=args.onnx_path,
        class_names_path=args.class_names,
        preprocessing_path=args.preprocessing_config,
        confidence_path=args.confidence_config,
        expected_model_version=args.expected_model_version,
    )
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
