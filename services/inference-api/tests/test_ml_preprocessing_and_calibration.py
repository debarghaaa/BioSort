import json
from pathlib import Path
import numpy as np
from PIL import Image

from app.schemas.config import CalibrationConfig, PreprocessingConfig
from app.services.inference import ONNXClassifierService, _apply_calibration
from app.services.preprocessing import preprocess_image
from tests.conftest import FakeOnnxSession, make_test_settings


def test_preprocessing_parity_rgb_and_bgr_layouts():
    img = Image.new("RGB", (256, 256), color=(255, 100, 10))
    rgb_spec = PreprocessingConfig(
        input_width=224,
        input_height=224,
        channel_order="RGB",
        tensor_layout="NCHW",
        resize_mode="center_crop",
        rescale_factor=1.0 / 255.0,
        normalization_mean=[0.0, 0.0, 0.0],
        normalization_std=[1.0, 1.0, 1.0],
    )
    rgb_tensor = preprocess_image(img, rgb_spec)
    assert rgb_tensor.shape == (1, 3, 224, 224)
    assert rgb_tensor.dtype == np.float32
    assert np.isclose(rgb_tensor[0, 0, 0, 0], 1.0, atol=1e-4)
    assert np.isclose(rgb_tensor[0, 2, 0, 0], 10.0 / 255.0, atol=1e-4)

    bgr_spec = rgb_spec.model_copy(update={"channel_order": "BGR", "tensor_layout": "NHWC"})
    bgr_tensor = preprocess_image(img, bgr_spec)
    assert bgr_tensor.shape == (1, 224, 224, 3)
    assert np.isclose(bgr_tensor[0, 0, 0, 0], 10.0 / 255.0, atol=1e-4)
    assert np.isclose(bgr_tensor[0, 0, 0, 2], 1.0, atol=1e-4)


def test_confidence_calibration_methods():
    logits = np.asarray([3.0, 1.0, 0.0], dtype=np.float32)

    none_probs = _apply_calibration(logits, CalibrationConfig(method="none"))
    assert none_probs is None

    temp_probs = _apply_calibration(
        logits, CalibrationConfig(method="temperature_scaling", temperature=2.0)
    )
    assert temp_probs is not None
    assert temp_probs.shape == (3,)
    assert np.isclose(float(np.sum(temp_probs)), 1.0, atol=1e-5)

    platt_probs = _apply_calibration(
        logits, CalibrationConfig(method="platt_scaling", platt_coef=1.0, platt_intercept=0.0)
    )
    assert platt_probs is not None
    assert np.isclose(float(np.sum(platt_probs)), 1.0, atol=1e-5)


def test_model_version_mismatch_fails_readiness(monkeypatch, tmp_path: Path):
    settings = make_test_settings(tmp_path)
    conf_path = Path(str(settings.confidence_config_path))
    conf_payload = json.loads(conf_path.read_text(encoding="utf-8"))
    conf_payload["model_version"] = "different-model-v99"
    conf_path.write_text(json.dumps(conf_payload), encoding="utf-8")

    monkeypatch.setattr(
        "app.services.inference.ort.InferenceSession",
        lambda *_args, **_kwargs: FakeOnnxSession(),
    )

    classifier = ONNXClassifierService()
    classifier.load_from_settings(settings)
    assert classifier.is_ready is False
    assert any("Model version mismatch" in err for err in classifier.readiness_errors)
