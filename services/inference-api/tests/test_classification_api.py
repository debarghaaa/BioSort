from pathlib import Path
from uuid import uuid4
from fastapi.testclient import TestClient

from app.core.config import get_settings
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


def test_unauthenticated_request_rejected_401(monkeypatch, tmp_path: Path):
    _app, client = _build_client(monkeypatch, tmp_path)
    try:
        resp = client.post(
            "/api/v1/classifications",
            files={"file": ("item.png", make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 401
    finally:
        client.__exit__(None, None, None)


def test_unauthorised_review_request_rejected_403(monkeypatch, tmp_path: Path):
    _app, client = _build_client(monkeypatch, tmp_path)
    try:
        operator_token = make_jwt_token(role="operator")
        resp = client.post(
            f"/api/v1/reviews/{uuid4()}",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={
                "action": "confirmed",
                "reviewer_notes": "Operator attempting review action.",
            },
        )
        assert resp.status_code == 403

        reviewer_token = make_jwt_token(role="reviewer")
        bad_tax = client.post(
            f"/api/v1/reviews/{uuid4()}",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={
                "action": "relabelled",
                "resolved_class": "arbitrary_unlisted_category",
                "reviewer_notes": "Attempt outside approved taxonomy.",
            },
        )
        assert bad_tax.status_code == 422

        target_id = uuid4()
        ok_resp = client.post(
            f"/api/v1/reviews/{target_id}",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={
                "action": "relabelled",
                "resolved_class": "sharps_needle",
                "reviewer_notes": "Verified needle tip in container.",
                "approved_for_dataset_export": True,
            },
        )
        assert ok_resp.status_code == 200
        body = ok_resp.json()
        assert body["queue_status"] == "relabelled"
        assert body["resolved_class"] == "sharps_needle"
        assert body["version"] == 2

        conflict_resp = client.post(
            f"/api/v1/reviews/{target_id}",
            headers={"Authorization": f"Bearer {reviewer_token}"},
            json={
                "action": "confirmed",
                "expected_version": 1,
                "reviewer_notes": "Stale version submission.",
            },
        )
        assert conflict_resp.status_code == 409
    finally:
        client.__exit__(None, None, None)


def test_valid_image_classification_verified_mapping(monkeypatch, tmp_path: Path):
    repo = FakeSupabaseRepository()
    _app, client = _build_client(monkeypatch, tmp_path, logits=[6.0, 0.2, 0.1], repo=repo)
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("sharps.jpg", make_jpeg_bytes(), "image/jpeg")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["predicted_class"] == "sharps_needle"
        assert body["decision_status"] == DecisionStatus.ACCEPTED.value
        assert body["recommended_bin"] == "BIN-SHARPS-01 — Puncture-Resistant Sharps Receptacle"
        assert body["requires_manual_review"] is False
        assert body["model_version"] == "mobilenetv3-test-v1"
        assert len(repo.saved_events) == 1
        assert len(repo.uploaded_paths) == 1
    finally:
        client.__exit__(None, None, None)


def test_low_confidence_prediction_routes_to_manual_review(monkeypatch, tmp_path: Path):
    # Nearly equal logits => low confidence & low margin
    _app, client = _build_client(monkeypatch, tmp_path, logits=[1.1, 1.0, 0.9])
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("uncertain.png", make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["decision_status"] == DecisionStatus.REVIEW_REQUIRED.value
        assert body["recommended_bin"] is None
        assert body["requires_manual_review"] is True
    finally:
        client.__exit__(None, None, None)


def test_unverified_or_unconfigured_mapping_blocks_bin_recommendation(monkeypatch, tmp_path: Path):
    # Class index 1 ("infectious_dressing") has UNVERIFIED mapping in test repo
    _app, client = _build_client(monkeypatch, tmp_path, logits=[0.1, 6.0, 0.1])
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("dressing.png", make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["predicted_class"] == "infectious_dressing"
        assert body["decision_status"] == DecisionStatus.MAPPING_UNCONFIGURED.value
        assert body["recommended_bin"] is None
        assert body["requires_manual_review"] is True
    finally:
        client.__exit__(None, None, None)


def test_invalid_mime_type_and_spoofed_extension_rejected(monkeypatch, tmp_path: Path):
    _app, client = _build_client(monkeypatch, tmp_path)
    try:
        token = make_jwt_token(role="operator")
        # Unsupported declared MIME
        resp1 = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("script.txt", b"not-an-image", "text/plain")},
        )
        assert resp1.status_code == 415

        # Spoofed MIME + .jpg extension with non-image bytes
        resp2 = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("spoof.jpg", b"#!/bin/sh\necho pwned", "image/jpeg")},
        )
        assert resp2.status_code == 400
    finally:
        client.__exit__(None, None, None)


def test_corrupted_image_rejected(monkeypatch, tmp_path: Path):
    _app, client = _build_client(monkeypatch, tmp_path)
    try:
        token = make_jwt_token(role="operator")
        corrupted = make_png_bytes()[:20] + b"\x00\xff\x00corrupted"
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("broken.png", corrupted, "image/png")},
        )
        assert resp.status_code == 400
    finally:
        client.__exit__(None, None, None)


def test_oversized_image_rejected(monkeypatch, tmp_path: Path):
    _app, client = _build_client(monkeypatch, tmp_path, max_image_bytes=128)
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("large.png", make_png_bytes(256, 256), "image/png")},
        )
        assert resp.status_code == 413
    finally:
        client.__exit__(None, None, None)


def test_storage_failure_returns_error_and_never_claims_saved(monkeypatch, tmp_path: Path):
    repo = FakeSupabaseRepository(fail_storage=True)
    _app, client = _build_client(monkeypatch, tmp_path, logits=[6.0, 0.2, 0.1], repo=repo)
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("item.png", make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 502
        assert len(repo.saved_events) == 0
    finally:
        client.__exit__(None, None, None)


def test_database_failure_returns_error_and_cleans_up_storage(monkeypatch, tmp_path: Path):
    repo = FakeSupabaseRepository(fail_database=True)
    _app, client = _build_client(monkeypatch, tmp_path, logits=[6.0, 0.2, 0.1], repo=repo)
    try:
        token = make_jwt_token(role="operator")
        resp = client.post(
            "/api/v1/classifications",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("item.png", make_png_bytes(), "image/png")},
        )
        assert resp.status_code == 502
        assert len(repo.saved_events) == 0
    finally:
        client.__exit__(None, None, None)


def test_monitoring_analytics_dashboard_alerts_and_csv_export(monkeypatch, tmp_path: Path):
    repo = FakeSupabaseRepository()
    _app, client = _build_client(monkeypatch, tmp_path, logits=[6.0, 0.2, 0.1], repo=repo)
    try:
        operator_token = make_jwt_token(role="operator")
        admin_token = make_jwt_token(role="admin")

        dash_resp = client.get(
            "/api/v1/analytics/dashboard?date_from=2026-11-01&date_to=2026-11-30",
            headers={"Authorization": f"Bearer {operator_token}"},
        )
        assert dash_resp.status_code == 200
        dash = dash_resp.json()
        assert "total_classifications" in dash
        assert "reviewed_comparison" in dash
        assert "thresholds" in dash

        forbidden_cfg = client.put(
            "/api/v1/analytics/alerts/config",
            headers={"Authorization": f"Bearer {operator_token}"},
            json={"pending_review_backlog_threshold": 5, "classification_failure_threshold": 2},
        )
        assert forbidden_cfg.status_code == 403

        admin_cfg = client.put(
            "/api/v1/analytics/alerts/config",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"pending_review_backlog_threshold": 5, "classification_failure_threshold": 2},
        )
        assert admin_cfg.status_code == 200
        assert admin_cfg.json()["pending_review_backlog_threshold"] == 5

        csv_resp = client.get(
            "/api/v1/analytics/export?report_type=analytics_summary",
            headers={"Authorization": f"Bearer {operator_token}"},
        )
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers["content-type"]
        assert "analytics_summary" in csv_resp.text
    finally:
        client.__exit__(None, None, None)

