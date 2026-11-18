from pathlib import Path
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app
from app.schemas.classification import DecisionStatus
from tests.conftest import (
    FakeOnnxSession,
    FakeSupabaseRepository,
    make_jpeg_bytes,
    make_jwt_token,
    make_png_bytes,
    make_test_settings,
)


def _build_client(monkeypatch, tmp_path: Path, logits=None, repo=None, **settings_overrides):
    settings = make_test_settings(tmp_path, **settings_overrides)
    monkeypatch.setattr(
        "app.services.inference.ort.InferenceSession",
        lambda *_args, **_kwargs: FakeOnnxSession(logits=logits),
    )
    app = create_app(settings_override=settings)
    app.dependency_overrides[get_settings] = lambda: settings
    client = TestClient(app)
    client.__enter__()
    app.state.repository = repo or FakeSupabaseRepository()
    return app, client


def test_e2e_low_confidence_to_manual_review_to_analytics(monkeypatch, tmp_path: Path):
    repo = FakeSupabaseRepository()
    _app, client = _build_client(monkeypatch, tmp_path, logits=[1.1, 1.0, 0.9], repo=repo)
    try:
        op_token = make_jwt_token(role="operator")
        rev_token = make_jwt_token(role="reviewer")

        # 1. Operator uploads uncertain image -> routed to review_required
        classify_resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {op_token}"},
            files={"file": ("uncertain.png", make_png_bytes(), "image/png")},
        )
        assert classify_resp.status_code == 200
        result = classify_resp.json()
        assert result["decision_status"] == DecisionStatus.REVIEW_REQUIRED.value
        assert result["recommended_bin"] is None
        assert result["requires_manual_review"] is True
        cid = result["classification_id"]

        # 2. Classification appears in history & pending manual review queue
        history_resp = client.get(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert history_resp.status_code == 200
        assert history_resp.json()["total"] == 1

        queue_resp = client.get(
            "/api/v1/reviews?status=pending",
            headers={"Authorization": f"Bearer {rev_token}"},
        )
        assert queue_resp.status_code == 200
        assert any(item["classification_id"] == cid for item in queue_resp.json()["items"])

        # 3. Reviewer resolves classification -> creates audit trail & updates analytics
        resolve_resp = client.post(
            f"/api/v1/reviews/{cid}",
            headers={"Authorization": f"Bearer {rev_token}"},
            json={
                "action": "relabelled",
                "resolved_class": "sharps_needle",
                "reviewer_notes": "Needle hub visible after manual inspection.",
                "expected_version": 1,
            },
        )
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["queue_status"] == "relabelled"
        assert len(resolve_resp.json()["review_history"]) >= 1

        dash_resp = client.get(
            "/api/v1/analytics/dashboard",
            headers={"Authorization": f"Bearer {op_token}"},
        )
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert dash["total_classifications"] == 1
        assert dash["resolved_review_count"] == 1
        assert dash["reviewed_comparison"]["relabelled_count"] == 1
    finally:
        client.__exit__(None, None, None)


def test_e2e_inference_unavailable_returns_controlled_503_never_fake_prediction(tmp_path: Path):
    settings = Settings(
        model_path=str(tmp_path / "missing.onnx"),
        supabase_jwt_secret="unit-test-supabase-jwt-secret-32chars!",
        rate_limit_enabled=False,
    )
    app = create_app(settings_override=settings)
    app.dependency_overrides[get_settings] = lambda: settings

    with TestClient(app) as client:
        app.state.repository = FakeSupabaseRepository()
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("item.jpg", make_jpeg_bytes(), "image/jpeg")},
        )
        assert resp.status_code == 503
        assert "detail" in resp.json()
        assert "predicted_class" not in resp.json()
        assert len(app.state.repository.saved_events) == 0


def test_startup_env_validation_reports_missing_keys_without_secrets():
    settings = Settings(
        supabase_url=None,
        supabase_service_role_key=None,
        supabase_jwt_secret=None,
        allowed_origins="",
    )
    errors = settings.validate_startup_environment()
    assert len(errors) >= 1
    assert any("SUPABASE_URL" in e for e in errors)
    assert any("ALLOWED_ORIGINS" in e for e in errors)
