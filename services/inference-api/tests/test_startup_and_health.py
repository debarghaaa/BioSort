from pathlib import Path
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.services.inference import ONNXClassifierService
from tests.conftest import (
    FakeOnnxSession,
    FakeSupabaseRepository,
    make_jwt_token,
    make_test_settings,
)


def test_liveness_alive_even_when_model_missing(tmp_path: Path):
    settings = Settings(
        model_path=str(tmp_path / "missing.onnx"),
        rate_limit_enabled=False,
    )
    app = create_app(settings_override=settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["status"] == "alive"

        ready_resp = client.get("/ready")
        assert ready_resp.status_code == 503
        body = ready_resp.json()
        assert body["status"] == "not_ready"
        assert body["model_loaded"] is False
        assert len(body["errors"]) >= 1


def test_model_loading_and_class_index_alignment_validation(monkeypatch, tmp_path: Path):
    settings = make_test_settings(tmp_path)

    # Mock onnxruntime.InferenceSession returning aligned 3-class session
    monkeypatch.setattr(
        "app.services.inference.ort.InferenceSession",
        lambda *_args, **_kwargs: FakeOnnxSession(logits=[3.0, 0.5, 0.1]),
    )

    classifier = ONNXClassifierService()
    classifier.load_from_settings(settings)

    assert classifier.is_ready is True
    assert classifier.model_version == "mobilenetv3-test-v1"
    assert len(classifier.class_names) == 3

    # Now simulate class-index mismatch (2 outputs vs 3 class names)
    monkeypatch.setattr(
        "app.services.inference.ort.InferenceSession",
        lambda *_args, **_kwargs: FakeOnnxSession(logits=[3.0, 0.5]),
    )
    bad_classifier = ONNXClassifierService()
    bad_classifier.load_from_settings(settings)
    assert bad_classifier.is_ready is False
    assert any("Class-index mismatch" in err for err in bad_classifier.readiness_errors)


def test_readiness_and_model_metadata_endpoint_when_ready(monkeypatch, tmp_path: Path):
    settings = make_test_settings(tmp_path)
    monkeypatch.setattr(
        "app.services.inference.ort.InferenceSession",
        lambda *_args, **_kwargs: FakeOnnxSession(),
    )

    app = create_app(settings_override=settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        app.state.repository = FakeSupabaseRepository()

        ready_resp = client.get("/ready")
        assert ready_resp.status_code == 200
        assert ready_resp.json()["status"] == "ready"
        assert ready_resp.json()["model_loaded"] is True

        token = make_jwt_token(role="operator")
        model_resp = client.get(
            "/api/v1/models/current",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert model_resp.status_code == 200
        assert model_resp.json()["model_version"] == "mobilenetv3-test-v1"
        assert len(model_resp.json()["class_names"]) == 3
