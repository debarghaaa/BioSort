import io
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
import jwt
import numpy as np
from PIL import Image

from app.core.config import Settings
from app.schemas.classification import (
    AnalyticsSummaryResponse,
    ClassificationRecordResponse,
    DecisionStatus,
    SharedClassificationResult,
)
from app.schemas.config import CategoryBinMapping, ConfidenceConfig, MappingVerificationStatus
from app.schemas.review import (
    ApprovedTaxonomyOption,
    DatasetFeedbackExportResponse,
    ReviewAuditEntry,
    ReviewQueueStatus,
    ReviewRecordResponse,
    ReviewSortOption,
    ReviewSubmissionRequest,
)
from app.services.preprocessing import ValidatedImagePayload

TEST_JWT_SECRET = "unit-test-supabase-jwt-secret-32chars!"


def make_jwt_token(role: str = "operator", user_id: str = "11111111-1111-1111-1111-111111111111") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": f"{role}@hospital.local",
        "aud": "authenticated",
        "app_metadata": {"role": role},
        "exp": int((now + timedelta(hours=1)).timestamp()),
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def make_png_bytes(width: int = 128, height: int = 128) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(120, 140, 160)).save(buf, format="PNG")
    return buf.getvalue()


def make_jpeg_bytes(width: int = 128, height: int = 128) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(200, 180, 160)).save(buf, format="JPEG")
    return buf.getvalue()


def write_test_artefacts(tmp_path: Path, model_exists: bool = True) -> Dict[str, str]:
    model_path = tmp_path / "classifier.onnx"
    if model_exists:
        model_path.write_bytes(b"mock-onnx-binary-header")

    classes_path = tmp_path / "class_names.json"
    classes_path.write_text(
        json.dumps(["sharps_needle", "infectious_dressing", "general_non_infectious"]),
        encoding="utf-8",
    )

    prep_path = tmp_path / "preprocessing.json"
    prep_path.write_text(
        json.dumps(
            {
                "input_width": 224,
                "input_height": 224,
                "channel_order": "RGB",
                "tensor_layout": "NCHW",
                "resize_mode": "center_crop",
                "rescale_factor": 1.0 / 255.0,
                "normalization_mean": [0.485, 0.456, 0.406],
                "normalization_std": [0.229, 0.224, 0.225],
            }
        ),
        encoding="utf-8",
    )

    conf_path = tmp_path / "confidence.json"
    conf_path.write_text(
        json.dumps(
            {
                "model_version": "mobilenetv3-test-v1",
                "jurisdiction_code": "US-OSHA",
                "accept_threshold": 0.85,
                "review_floor_threshold": 0.50,
                "minimum_margin_over_second": 0.15,
                "require_calibrated_confidence": True,
                "calibration": {"method": "temperature_scaling", "temperature": 1.0},
            }
        ),
        encoding="utf-8",
    )

    return {
        "model_path": str(model_path),
        "class_names_path": str(classes_path),
        "preprocessing_config_path": str(prep_path),
        "confidence_config_path": str(conf_path),
        "model_version": "mobilenetv3-test-v1",
    }


class FakeTensorMeta:
    def __init__(self, name: str, shape: List[Optional[int]]) -> None:
        self.name = name
        self.shape = shape


class FakeOnnxSession:
    def __init__(self, logits: Optional[List[float]] = None) -> None:
        self.logits = logits or [4.0, 0.2, 0.1]

    def get_inputs(self):
        return [FakeTensorMeta("input", [1, 3, 224, 224])]

    def get_outputs(self):
        return [FakeTensorMeta("logits", [1, len(self.logits)])]

    def run(self, _output_names, _inputs):
        return [np.asarray([self.logits], dtype=np.float32)]


class FakeSupabaseRepository:
    def __init__(
        self,
        mappings: Optional[List[CategoryBinMapping]] = None,
        fail_storage: bool = False,
        fail_database: bool = False,
    ) -> None:
        self.mappings = mappings or [
            CategoryBinMapping(
                jurisdiction_code="US-OSHA",
                class_name="sharps_needle",
                target_bin_code="BIN-SHARPS-01",
                target_bin_label="Puncture-Resistant Sharps Receptacle",
                verification_status=MappingVerificationStatus.VERIFIED,
            ),
            CategoryBinMapping(
                jurisdiction_code="US-OSHA",
                class_name="infectious_dressing",
                target_bin_code="BIN-BIO-02",
                target_bin_label="Biohazard Regulated Receptacle",
                verification_status=MappingVerificationStatus.UNVERIFIED,
            ),
        ]
        self.taxonomy = [
            ApprovedTaxonomyOption(
                id=UUID("33333333-3333-3333-3333-333333333301"),
                class_code="sharps_needle",
                display_name="Sharps & Needles",
                taxonomy_version="v1",
            ),
            ApprovedTaxonomyOption(
                id=UUID("33333333-3333-3333-3333-333333333302"),
                class_code="infectious_dressing",
                display_name="Infectious Dressing",
                taxonomy_version="v1",
            ),
            ApprovedTaxonomyOption(
                id=UUID("33333333-3333-3333-3333-333333333303"),
                class_code="general_non_infectious",
                display_name="General Non-Infectious Waste",
                taxonomy_version="v1",
            ),
        ]
        self.fail_storage = fail_storage
        self.fail_database = fail_database
        self.saved_events: List[Dict[str, Any]] = []
        self.reviews: Dict[UUID, ReviewRecordResponse] = {}
        self.uploaded_paths: List[str] = []
        self.deleted_paths: List[str] = []

    def check_connection(self) -> Tuple[bool, Optional[str]]:
        return (False, "Simulated DB failure") if self.fail_database else (True, None)

    def load_policy_and_mappings(
        self, jurisdiction_code: Optional[str]
    ) -> Tuple[Optional[ConfidenceConfig], List[CategoryBinMapping]]:
        if self.fail_database:
            from app.services.storage import DatabasePersistenceError

            raise DatabasePersistenceError("Simulated PostgreSQL query failure.")
        return None, self.mappings

    def upload_evidence_image(
        self,
        classification_id: UUID,
        image: ValidatedImagePayload,
        owner_id: Optional[str] = None,
    ) -> str:
        if self.fail_storage:
            from app.services.storage import StorageIntegrationError

            raise StorageIntegrationError("Simulated Supabase Storage upload failure.")
        prefix = owner_id or "service"
        path = f"{prefix}/{classification_id}.{image.file_extension}"
        self.uploaded_paths.append(path)
        return path

    def save_classification_event(
        self,
        result: SharedClassificationResult,
        image: ValidatedImagePayload,
        image_filename: Optional[str],
        storage_path: str,
        jurisdiction_code: Optional[str],
        policy_snapshot: Dict[str, Any],
        uploaded_by: str,
        actor_role: str,
    ) -> None:
        if self.fail_database:
            self.deleted_paths.append(storage_path)
            from app.services.storage import DatabasePersistenceError

            raise DatabasePersistenceError("Simulated PostgreSQL insert failure.")
        self.saved_events.append(
            {
                "result": result,
                "storage_path": storage_path,
                "uploaded_by": uploaded_by,
                "actor_role": actor_role,
            }
        )
        if result.requires_manual_review:
            top = result.candidate_predictions[0] if result.candidate_predictions else None
            self.reviews[result.classification_id] = ReviewRecordResponse(
                id=UUID("22222222-2222-2222-2222-222222222222"),
                classification_id=result.classification_id,
                queue_status="pending",
                version=1,
                predicted_class=result.predicted_class,
                candidate_predictions=result.candidate_predictions,
                model_score=top.model_score if top else None,
                calibrated_confidence=top.calibrated_confidence if top else None,
                original_decision_status=result.decision_status,
                model_version=result.model_version,
                preprocessing_version="prep-v1",
                review_reason=result.review_reason or "Manual review required.",
                image_storage_path=storage_path,
                created_at=result.created_at,
            )

    def list_bin_mappings(self, jurisdiction_code: Optional[str] = None) -> List[CategoryBinMapping]:
        return self.mappings

    def list_approved_taxonomy(self) -> List[ApprovedTaxonomyOption]:
        return self.taxonomy

    def list_reviews(
        self,
        queue_status: Optional[ReviewQueueStatus] = None,
        predicted_category: Optional[str] = None,
        model_version: Optional[str] = None,
        review_reason: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort: ReviewSortOption = "oldest_first",
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[ReviewRecordResponse], int]:
        items = list(self.reviews.values())
        if queue_status:
            items = [i for i in items if i.queue_status == queue_status]
        return items[offset : offset + limit], len(items)

    def get_review_detail(self, classification_id: UUID) -> Optional[ReviewRecordResponse]:
        return self.reviews.get(classification_id)

    def claim_review(
        self,
        classification_id: UUID,
        reviewer_id: str,
        expected_version: Optional[int] = None,
    ) -> Optional[ReviewRecordResponse]:
        rec = self.reviews.get(classification_id)
        if not rec:
            return None
        if expected_version is not None and rec.version != expected_version:
            from app.services.storage import ReviewConflictError

            raise ReviewConflictError("Version conflict while claiming review.")
        updated = rec.model_copy(
            update={
                "queue_status": "in_progress",
                "claimed_by": UUID(reviewer_id),
                "claimed_at": datetime.now(timezone.utc),
                "version": rec.version + 1,
            }
        )
        self.reviews[classification_id] = updated
        return updated

    def save_review_decision(
        self,
        classification_id: UUID,
        payload: ReviewSubmissionRequest,
        reviewer_id: str,
        reviewer_role: str,
    ) -> Optional[ReviewRecordResponse]:
        from app.services.storage import ReviewConflictError, ReviewValidationError

        if payload.action == "relabelled":
            allowed = {t.class_code for t in self.taxonomy}
            if payload.resolved_class not in allowed:
                raise ReviewValidationError(
                    f"Category '{payload.resolved_class}' is not an active approved taxonomy class."
                )

        existing = self.reviews.get(classification_id)
        if existing and payload.expected_version is not None and existing.version != payload.expected_version:
            raise ReviewConflictError("Concurrent review submission conflict.")

        now = datetime.now(timezone.utc)
        base = existing or ReviewRecordResponse(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            classification_id=classification_id,
            queue_status="pending",
            version=1,
            predicted_class="sharps_needle",
            created_at=now,
        )
        resolved = base.predicted_class if payload.action == "confirmed" else (
            payload.resolved_class if payload.action == "relabelled" else None
        )
        updated = base.model_copy(
            update={
                "queue_status": payload.action,
                "version": base.version + 1,
                "resolved_class": resolved,
                "reviewer_notes": payload.reviewer_notes,
                "reviewer_id": UUID(reviewer_id),
                "reviewed_at": now,
                "approved_for_dataset_export": payload.approved_for_dataset_export,
                "review_history": [
                    ReviewAuditEntry(
                        id=UUID("44444444-4444-4444-4444-444444444444"),
                        actor_id=reviewer_id,
                        actor_role=reviewer_role,
                        event_type=f"manual_reviews.decision.{payload.action}",
                        entity_id=str(base.id),
                        before_state={"queue_status": base.queue_status},
                        after_state={"queue_status": payload.action, "resolved_class": resolved},
                        created_at=now,
                    ),
                    *base.review_history,
                ],
            }
        )
        self.reviews[classification_id] = updated
        return updated

    def export_approved_dataset_feedback(self) -> DatasetFeedbackExportResponse:
        return DatasetFeedbackExportResponse(
            exported_at=datetime.now(timezone.utc),
            total_approved_records=0,
            training_workflow_notice="Test export notice.",
            items=[],
        )

    def list_classifications(
        self,
        decision_status: Optional[DecisionStatus] = None,
        requires_manual_review: Optional[bool] = None,
        category: Optional[str] = None,
        model_version: Optional[str] = None,
        review_status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> Tuple[List[ClassificationRecordResponse], int]:
        records: List[ClassificationRecordResponse] = []
        for entry in reversed(self.saved_events):
            res: SharedClassificationResult = entry["result"]
            rev = self.reviews.get(res.classification_id)
            effective_review_status = rev.queue_status if rev else "not_required"
            if decision_status and res.decision_status != decision_status:
                continue
            if requires_manual_review is not None and res.requires_manual_review != requires_manual_review:
                continue
            if category and res.predicted_class != category:
                continue
            if model_version and res.model_version != model_version:
                continue
            if review_status and effective_review_status != review_status:
                continue
            records.append(
                ClassificationRecordResponse(
                    classification_id=res.classification_id,
                    predicted_class=res.predicted_class,
                    candidate_predictions=res.candidate_predictions,
                    model_version=res.model_version,
                    decision_status=res.decision_status,
                    recommended_bin=res.recommended_bin,
                    requires_manual_review=res.requires_manual_review,
                    review_reason=res.review_reason,
                    created_at=res.created_at,
                    image_storage_path=entry.get("storage_path"),
                    preprocessing_version="prep-v1",
                    review_status=effective_review_status,
                    resolved_class=rev.resolved_class if rev else None,
                )
            )
        return records[offset : offset + limit], len(records)

    def get_classification(self, classification_id: UUID) -> Optional[ClassificationRecordResponse]:
        items, _ = self.list_classifications(limit=1000, offset=0)
        for item in items:
            if item.classification_id == classification_id:
                return item
        return None

    def get_analytics_summary(self) -> AnalyticsSummaryResponse:
        counts = {
            DecisionStatus.ACCEPTED.value: 0,
            DecisionStatus.REVIEW_REQUIRED.value: 0,
            DecisionStatus.MAPPING_UNCONFIGURED.value: 0,
            DecisionStatus.REJECTED.value: 0,
        }
        for entry in self.saved_events:
            st = entry["result"].decision_status.value
            if st in counts:
                counts[st] += 1
        pending = sum(1 for r in self.reviews.values() if r.queue_status in ("pending", "in_progress"))
        resolved = sum(1 for r in self.reviews.values() if r.queue_status in ("confirmed", "relabelled", "unresolved"))
        return AnalyticsSummaryResponse(
            total_events=len(self.saved_events),
            by_decision_status=counts,
            pending_reviews=pending,
            resolved_reviews=resolved,
            source_note="Test repository",
        )

    def get_alert_thresholds(self):
        from app.schemas.analytics import OperationalAlertThresholds

        return OperationalAlertThresholds()

    def update_alert_thresholds(self, payload, actor_id: str):
        return payload

    def get_monitoring_dashboard(self, model_loaded: bool = True, **_kwargs):
        from app.schemas.analytics import (
            MonitoringDashboardResponse,
            OperationalAlertItem,
            OperationalAlertThresholds,
            ReviewedComparisonSummary,
        )

        accepted = sum(1 for e in self.saved_events if e["result"].decision_status == DecisionStatus.ACCEPTED)
        unconfigured = sum(
            1 for e in self.saved_events if e["result"].decision_status == DecisionStatus.MAPPING_UNCONFIGURED
        )
        pending = sum(1 for r in self.reviews.values() if r.queue_status in ("pending", "in_progress"))
        resolved = sum(
            1 for r in self.reviews.values() if r.queue_status in ("confirmed", "relabelled", "unresolved")
        )
        confirmed = sum(1 for r in self.reviews.values() if r.queue_status == "confirmed")
        relabelled = sum(1 for r in self.reviews.values() if r.queue_status == "relabelled")
        comp_total = confirmed + relabelled

        return MonitoringDashboardResponse(
            generated_at=datetime.now(timezone.utc),
            total_classifications=len(self.saved_events),
            accepted_predictions=accepted,
            review_required=pending,
            unconfigured_mappings=unconfigured,
            rejected_inputs=0,
            average_model_score=None,
            average_calibrated_confidence=None,
            calibrated_sample_count=0,
            total_review_records=len(self.reviews),
            resolved_review_count=resolved,
            review_resolution_rate=(
                round((resolved / len(self.reviews)) * 100, 2) if self.reviews else None
            ),
            pending_queue_backlog=pending,
            reviewed_comparison=ReviewedComparisonSummary(
                comparison_sample_count=comp_total,
                confirmed_count=confirmed,
                relabelled_count=relabelled,
                agreement_rate_pct=round((confirmed / comp_total) * 100, 2) if comp_total else None,
            ),
            thresholds=OperationalAlertThresholds(),
            alerts=[
                OperationalAlertItem(
                    event="model_unavailable",
                    severity="critical",
                    active=not model_loaded,
                    title="Active ONNX Classifier Unavailable",
                    detail="Ready" if model_loaded else "Unavailable",
                )
            ],
            source_note="Test repository",
        )

    def export_analytics_csv(self, report_type: str, **_kwargs) -> str:
        return f"report_type,value\n{report_type},{len(self.saved_events)}\n"


def make_test_settings(tmp_path: Path, **overrides: Any) -> Settings:
    artefacts = write_test_artefacts(tmp_path)
    base: Dict[str, Any] = {
        **artefacts,
        "supabase_url": "https://example.supabase.co",
        "supabase_service_role_key": "service-role-test",
        "supabase_jwt_secret": TEST_JWT_SECRET,
        "rate_limit_enabled": False,
        "max_image_bytes": 2 * 1024 * 1024,
    }
    base.update(overrides)
    return Settings(**base)
