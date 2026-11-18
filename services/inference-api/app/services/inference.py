import json
from pathlib import Path
from typing import List, Optional
import numpy as np
import onnxruntime as ort

from ..core.config import Settings
from ..core.logging import get_logger
from ..schemas.classification import CandidatePrediction
from ..schemas.config import CalibrationConfig, ConfidenceConfig, PreprocessingConfig

logger = get_logger(__name__)


class ModelNotReadyError(RuntimeError):
    """Raised when the ONNX classifier or its exported artefacts are not loaded."""


def _softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp_vals = np.exp(shifted)
    return exp_vals / np.sum(exp_vals)


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -60.0, 60.0)))


def _apply_calibration(
    raw_logits: np.ndarray,
    calibration: CalibrationConfig,
) -> Optional[np.ndarray]:
    if calibration.method == "none":
        return None
    if calibration.method == "temperature_scaling":
        if not calibration.temperature or calibration.temperature <= 0:
            return None
        return _softmax(raw_logits / float(calibration.temperature))
    if calibration.method == "platt_scaling":
        if calibration.platt_coef is None or calibration.platt_intercept is None:
            return None
        scaled = float(calibration.platt_coef) * raw_logits + float(calibration.platt_intercept)
        probs = _sigmoid(scaled)
        total = float(np.sum(probs))
        return probs / total if total > 0 else None
    return None


class ONNXClassifierService:
    """
    Loads the ONNX model and exported Colab artefacts ONCE at application startup.
    Validates file presence, input tensor dimensions, and class-index alignment.
    """

    def __init__(self) -> None:
        self.session: Optional[ort.InferenceSession] = None
        self.input_name: Optional[str] = None
        self.input_shape: List[Optional[int]] = []
        self.output_name: Optional[str] = None
        self.model_version: Optional[str] = None
        self.class_names: List[str] = []
        self.preprocessing_config: Optional[PreprocessingConfig] = None
        self.confidence_config: Optional[ConfidenceConfig] = None
        self.readiness_errors: List[str] = []

    @property
    def is_ready(self) -> bool:
        return (
            self.session is not None
            and self.preprocessing_config is not None
            and self.confidence_config is not None
            and bool(self.class_names)
            and bool(self.model_version)
            and len(self.readiness_errors) == 0
        )

    def load_from_settings(self, settings: Settings) -> None:
        self.readiness_errors = []
        self.session = None

        required_paths = {
            "MODEL_PATH": settings.model_path,
            "CLASS_NAMES_PATH": settings.class_names_path,
            "PREPROCESSING_CONFIG_PATH": settings.preprocessing_config_path,
            "CONFIDENCE_CONFIG_PATH": settings.confidence_config_path,
            "MODEL_VERSION": settings.model_version,
        }
        missing_vars = [k for k, v in required_paths.items() if not v]
        if missing_vars:
            self.readiness_errors.append(
                f"Missing required model configuration variables: {', '.join(missing_vars)}."
            )
            logger.warning(
                "Model artefacts unconfigured at startup",
                extra={"extra_fields": {"missing": missing_vars}},
            )
            return

        model_file = Path(str(settings.model_path))
        classes_file = Path(str(settings.class_names_path))
        prep_file = Path(str(settings.preprocessing_config_path))
        conf_file = Path(str(settings.confidence_config_path))

        for label, file_path in [
            ("MODEL_PATH", model_file),
            ("CLASS_NAMES_PATH", classes_file),
            ("PREPROCESSING_CONFIG_PATH", prep_file),
            ("CONFIDENCE_CONFIG_PATH", conf_file),
        ]:
            if not file_path.is_file():
                self.readiness_errors.append(f"{label} file does not exist: {file_path}")

        if self.readiness_errors:
            logger.error(
                "Model artefact files missing",
                extra={"extra_fields": {"errors": self.readiness_errors}},
            )
            return

        try:
            raw_classes = json.loads(classes_file.read_text(encoding="utf-8"))
            if isinstance(raw_classes, dict) and "class_names" in raw_classes:
                class_list = list(raw_classes["class_names"])
            elif isinstance(raw_classes, list):
                class_list = list(raw_classes)
            else:
                raise ValueError("CLASS_NAMES_PATH must be a JSON array or {'class_names': [...]}.")
            if not class_list or not all(isinstance(c, str) and c.strip() for c in class_list):
                raise ValueError("CLASS_NAMES_PATH contains empty or non-string class entries.")
            self.class_names = class_list

            self.preprocessing_config = PreprocessingConfig.model_validate_json(
                prep_file.read_text(encoding="utf-8")
            )
            self.confidence_config = ConfidenceConfig.model_validate_json(
                conf_file.read_text(encoding="utf-8")
            )
            self.model_version = str(settings.model_version).strip()
            if (
                self.confidence_config.model_version
                and self.confidence_config.model_version.strip() != self.model_version
            ):
                raise ValueError(
                    f"Model version mismatch: MODEL_VERSION='{self.model_version}' does not match "
                    f"confidence config model_version='{self.confidence_config.model_version}'."
                )

            session = ort.InferenceSession(
                str(model_file),
                providers=["CPUExecutionProvider"],
            )
            inputs = session.get_inputs()
            outputs = session.get_outputs()
            if not inputs or not outputs:
                raise ValueError("ONNX graph must define at least one input and one output tensor.")

            input_meta = inputs[0]
            output_meta = outputs[0]
            self.input_name = input_meta.name
            self.output_name = output_meta.name
            self.input_shape = [
                int(dim) if isinstance(dim, int) else None for dim in input_meta.shape
            ]

            self._validate_tensor_alignment(
                self.input_shape,
                [int(dim) if isinstance(dim, int) else None for dim in output_meta.shape],
                self.preprocessing_config,
                self.class_names,
            )
            self.session = session
            logger.info(
                "ONNX classifier loaded successfully",
                extra={
                    "extra_fields": {
                        "model_version": self.model_version,
                        "num_classes": len(self.class_names),
                        "input_shape": self.input_shape,
                    }
                },
            )
        except Exception as exc:
            self.session = None
            self.readiness_errors.append(f"Failed to load or validate ONNX artefacts: {exc}")
            logger.exception("ONNX model startup validation failed")

    @staticmethod
    def _validate_tensor_alignment(
        input_shape: List[Optional[int]],
        output_shape: List[Optional[int]],
        prep: PreprocessingConfig,
        class_names: List[str],
    ) -> None:
        if len(input_shape) != 4:
            raise ValueError(f"Expected 4D ONNX image input tensor, got shape {input_shape}.")

        if prep.tensor_layout == "NCHW":
            expected = (3, prep.input_height, prep.input_width)
            actual = (input_shape[1], input_shape[2], input_shape[3])
        else:
            expected = (prep.input_height, prep.input_width, 3)
            actual = (input_shape[1], input_shape[2], input_shape[3])

        for exp_dim, act_dim in zip(expected, actual):
            if act_dim is not None and act_dim != exp_dim:
                raise ValueError(
                    f"ONNX input shape {input_shape} does not match preprocessing spec "
                    f"({prep.tensor_layout}, {expected})."
                )

        if len(output_shape) != 2:
            raise ValueError(f"Expected 2D ONNX logits output [batch, classes], got {output_shape}.")

        num_outputs = output_shape[1]
        if num_outputs is not None and num_outputs != len(class_names):
            raise ValueError(
                f"Class-index mismatch: ONNX output size {num_outputs} != len(class_names) {len(class_names)}."
            )

    def predict(self, input_tensor: np.ndarray) -> List[CandidatePrediction]:
        if not self.is_ready or self.session is None or self.input_name is None:
            raise ModelNotReadyError(
                "; ".join(self.readiness_errors) or "ONNX model is not ready."
            )

        outputs = self.session.run(None, {self.input_name: input_tensor})
        raw_logits = np.asarray(outputs[0], dtype=np.float32)
        if raw_logits.ndim == 2 and raw_logits.shape[0] == 1:
            raw_logits = raw_logits[0]
        else:
            raw_logits = raw_logits.squeeze()

        if raw_logits.ndim != 1 or len(raw_logits) != len(self.class_names):
            raise RuntimeError(
                f"Runtime ONNX logits shape mismatch: got {raw_logits.shape}, expected ({len(self.class_names)},)."
            )

        raw_scores = _softmax(raw_logits)
        calibrated_probs = (
            _apply_calibration(raw_logits, self.confidence_config.calibration)
            if self.confidence_config is not None
            else None
        )

        candidates: List[CandidatePrediction] = []
        for idx, class_name in enumerate(self.class_names):
            candidates.append(
                CandidatePrediction(
                    class_name=class_name,
                    model_score=float(raw_scores[idx]),
                    calibrated_confidence=(
                        float(calibrated_probs[idx]) if calibrated_probs is not None else None
                    ),
                )
            )

        candidates.sort(key=lambda item: item.model_score, reverse=True)
        return candidates
