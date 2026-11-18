import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from ..core.config import Settings
from ..core.logging import get_logger, request_id_ctx
from ..schemas.analytics import (
    CategoryDistributionItem,
    ConfidenceBinItem,
    DailyVolumePoint,
    DecisionDistributionItem,
    ModelComparisonItem,
    MonitoringDashboardResponse,
    OperationalAlertItem,
    OperationalAlertThresholds,
    ReviewedComparisonSummary,
    ReviewTrendPoint,
    VirtualBinAssignmentItem,
)
from ..schemas.classification import (
    AnalyticsSummaryResponse,
    CandidatePrediction,
    ClassificationRecordResponse,
    DecisionStatus,
    SharedClassificationResult,
)
from ..schemas.config import CategoryBinMapping, ConfidenceConfig, MappingVerificationStatus
from ..schemas.review import (
    ApprovedTaxonomyOption,
    DatasetFeedbackExportItem,
    DatasetFeedbackExportResponse,
    ReviewAuditEntry,
    ReviewQueueStatus,
    ReviewRecordResponse,
    ReviewSortOption,
    ReviewSubmissionRequest,
)
from .preprocessing import ValidatedImagePayload

logger = get_logger(__name__)


class StorageIntegrationError(RuntimeError):
    """Raised when Supabase Storage upload fails."""


class DatabasePersistenceError(RuntimeError):
    """Raised when Supabase PostgreSQL persistence or query fails."""


class ReviewConflictError(RuntimeError):
    """Raised on concurrent modification or conflicting review state."""


class ReviewValidationError(ValueError):
    """Raised when review input violates taxonomy or governance constraints."""


def _map_db_mapping_status(db_status: str) -> MappingVerificationStatus:
    if db_status == "verified":
        return MappingVerificationStatus.VERIFIED
    if db_status == "disabled":
        return MappingVerificationStatus.DEPRECATED
    return MappingVerificationStatus.UNVERIFIED


def _derive_queue_status(row: Dict[str, Any]) -> ReviewQueueStatus:
    q = row.get("queue_status")
    if q in ("pending", "in_progress", "confirmed", "relabelled", "unresolved"):
        return q  # type: ignore[return-value]
    if row.get("reviewed_at") is None:
        return "pending"
    outcome = row.get("review_outcome")
    if outcome in ("confirmed", "relabelled", "unresolved"):
        return outcome  # type: ignore[return-value]
    return "pending"


class SupabaseRepository:
    """
    Server-side Supabase PostgreSQL & private Storage repository aligned with
    canonical tables: profiles, waste_taxonomy, bin_mappings, model_versions,
    classification_events, manual_reviews, audit_events, and analytics views.
    Never stores binary image bytes in PostgreSQL and never claims success on failure.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: Optional[Any] = None

    @property
    def is_configured(self) -> bool:
        return bool(self.settings.supabase_url and self.settings.supabase_service_role_key)

    def _get_client(self) -> Any:
        if not self.is_configured:
            raise DatabasePersistenceError(
                "Supabase backend credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are not configured."
            )
        if self._client is None:
            from supabase import create_client

            self._client = create_client(
                str(self.settings.supabase_url),
                str(self.settings.supabase_service_role_key),
            )
        return self._client

    def check_connection(self) -> Tuple[bool, Optional[str]]:
        if not self.is_configured:
            return False, "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured."
        try:
            client = self._get_client()
            client.table("model_versions").select("id").limit(1).execute()
            return True, None
        except Exception as exc:
            return False, f"Supabase PostgreSQL connectivity check failed: {exc}"

    def load_policy_and_mappings(
        self, jurisdiction_code: Optional[str]
    ) -> Tuple[Optional[ConfidenceConfig], List[CategoryBinMapping]]:
        client = self._get_client()
        target_jurisdiction = jurisdiction_code or self.settings.default_jurisdiction_code or "DEFAULT"

        try:
            rows = (
                client.table("bin_mappings")
                .select("*, waste_taxonomy(class_code)")
                .execute()
                .data
                or []
            )
            mappings: List[CategoryBinMapping] = []
            for row in rows:
                taxonomy = row.get("waste_taxonomy") or {}
                class_code = taxonomy.get("class_code")
                if not class_code:
                    continue
                policy_ref = str(row.get("policy_reference") or target_jurisdiction)
                mappings.append(
                    CategoryBinMapping(
                        jurisdiction_code=policy_ref,
                        class_name=class_code,
                        target_bin_code=row["bin_code"],
                        target_bin_label=row["display_name"],
                        handling_notes=policy_ref,
                        verification_status=_map_db_mapping_status(row["mapping_status"]),
                    )
                )
            return None, mappings
        except Exception as exc:
            raise DatabasePersistenceError(
                f"Failed to query bin mappings from PostgreSQL: {exc}"
            ) from exc

    def upload_evidence_image(
        self,
        classification_id: UUID,
        image: ValidatedImagePayload,
        owner_id: Optional[str] = None,
    ) -> str:
        client = self._get_client()
        prefix = owner_id or "service"
        storage_path = f"{prefix}/{classification_id}.{image.file_extension}"
        try:
            client.storage.from_(self.settings.supabase_evidence_bucket).upload(
                path=storage_path,
                file=image.raw_bytes,
                file_options={"content-type": image.mime_type},
            )
            return storage_path
        except Exception as exc:
            logger.error(
                "Supabase Storage upload failed",
                extra={"extra_fields": {"classification_id": str(classification_id), "error": str(exc)}},
            )
            raise StorageIntegrationError(f"Evidence image upload failed: {exc}") from exc

    def _create_evidence_signed_url(self, storage_path: Optional[str], ttl_seconds: int = 180) -> Optional[str]:
        if not storage_path:
            return None
        try:
            client = self._get_client()
            resp = client.storage.from_(self.settings.supabase_evidence_bucket).create_signed_url(
                storage_path, ttl_seconds
            )
            if isinstance(resp, dict):
                return resp.get("signedURL") or resp.get("signedUrl")
            return getattr(resp, "signed_url", None)
        except Exception:
            return None

    def _delete_evidence_object(self, storage_path: str) -> None:
        try:
            client = self._get_client()
            client.storage.from_(self.settings.supabase_evidence_bucket).remove([storage_path])
        except Exception:
            logger.warning(
                "Failed compensating delete of storage object after DB failure",
                extra={"extra_fields": {"storage_path": storage_path}},
            )

    def _resolve_taxonomy_id(self, client: Any, class_code: Optional[str]) -> Optional[str]:
        if not class_code:
            return None
        resp = (
            client.table("waste_taxonomy")
            .select("id")
            .eq("class_code", class_code)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        return rows[0]["id"] if rows else None

    def _resolve_model_version_id(self, client: Any, model_version: str) -> str:
        resp = (
            client.table("model_versions")
            .select("id")
            .eq("model_version", model_version)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise DatabasePersistenceError(
                f"Model version '{model_version}' is not registered in public.model_versions."
            )
        return str(rows[0]["id"])

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
        client = self._get_client()
        try:
            predicted_class_id = self._resolve_taxonomy_id(client, result.predicted_class)
            model_version_id = self._resolve_model_version_id(client, result.model_version)
            top = result.candidate_predictions[0] if result.candidate_predictions else None
            recommended_bin_code = (
                result.recommended_bin.split(" — ")[0].strip()
                if result.decision_status == DecisionStatus.ACCEPTED and result.recommended_bin
                else None
            )
            review_status = "pending" if result.requires_manual_review else "not_required"

            row_payload = {
                "id": str(result.classification_id),
                "created_by": uploaded_by,
                "image_object_path": storage_path,
                "predicted_class_id": predicted_class_id,
                "candidate_predictions": [c.model_dump() for c in result.candidate_predictions],
                "model_score": top.model_score if top else None,
                "calibrated_confidence": top.calibrated_confidence if top else None,
                "confidence_threshold": policy_snapshot.get("accept_threshold"),
                "decision_status": result.decision_status.value,
                "recommended_bin_code": recommended_bin_code,
                "review_status": review_status,
                "model_version_id": model_version_id,
                "request_id": request_id_ctx.get("-"),
                "created_at": result.created_at.isoformat(),
            }
            client.table("classification_events").insert(row_payload).execute()

            if result.requires_manual_review:
                client.table("manual_reviews").insert(
                    {
                        "classification_id": str(result.classification_id),
                        "review_outcome": "unresolved",
                        "queue_status": "pending",
                        "review_reason": result.review_reason or "Routed for manual review.",
                    }
                ).execute()

            client.table("audit_events").insert(
                {
                    "actor_id": uploaded_by,
                    "event_type": "classification_events.insert",
                    "entity_type": "classification_events",
                    "entity_id": str(result.classification_id),
                    "before_state": None,
                    "after_state": {
                        "decision_status": result.decision_status.value,
                        "recommended_bin_code": recommended_bin_code,
                        "model_version": result.model_version,
                        "image_sha256": image.sha256,
                        "actor_role": actor_role,
                    },
                }
            ).execute()
        except Exception as exc:
            self._delete_evidence_object(storage_path)
            logger.error(
                "PostgreSQL classification persistence failed",
                extra={"extra_fields": {"classification_id": str(result.classification_id), "error": str(exc)}},
            )
            raise DatabasePersistenceError(
                f"Failed to persist classification event in PostgreSQL: {exc}"
            ) from exc

    def _row_to_record_response(
        self,
        row: Dict[str, Any],
        resolved_class_map: Optional[Dict[str, str]] = None,
    ) -> ClassificationRecordResponse:
        taxonomy = row.get("waste_taxonomy") or {}
        model_meta = row.get("model_versions") or {}
        candidates = [
            CandidatePrediction(**c) for c in (row.get("candidate_predictions") or [])
        ]
        event_id = str(row["id"])
        return ClassificationRecordResponse(
            classification_id=UUID(event_id),
            predicted_class=taxonomy.get("class_code"),
            candidate_predictions=candidates,
            decision_status=DecisionStatus(row["decision_status"]),
            recommended_bin=row.get("recommended_bin_code"),
            requires_manual_review=row.get("review_status") != "not_required",
            review_reason=None,
            model_version=model_meta.get("model_version", "unknown"),
            preprocessing_version=model_meta.get("preprocessing_version"),
            review_status=row.get("review_status"),
            resolved_class=(resolved_class_map or {}).get(event_id),
            created_at=row["created_at"],
            image_storage_path=row.get("image_object_path"),
        )

    def _fetch_resolved_class_map(self, client: Any, classification_ids: List[str]) -> Dict[str, str]:
        if not classification_ids:
            return {}
        try:
            rows = (
                client.table("manual_reviews")
                .select("classification_id, waste_taxonomy!manual_reviews_confirmed_class_id_fkey(class_code)")
                .in_("classification_id", classification_ids)
                .execute()
                .data
                or []
            )
            mapping: Dict[str, str] = {}
            for row in rows:
                tax = row.get("waste_taxonomy") or {}
                if tax.get("class_code"):
                    mapping[str(row["classification_id"])] = str(tax["class_code"])
            return mapping
        except Exception:
            return {}

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
        client = self._get_client()
        try:
            tax_join = "waste_taxonomy!inner(class_code)" if category else "waste_taxonomy(class_code)"
            model_join = (
                "model_versions!inner(model_version, preprocessing_version)"
                if model_version
                else "model_versions(model_version, preprocessing_version)"
            )
            query = client.table("classification_events").select(
                f"*, {tax_join}, {model_join}",
                count="exact",
            )
            if decision_status is not None:
                query = query.eq("decision_status", decision_status.value)
            if requires_manual_review is True:
                query = query.neq("review_status", "not_required")
            elif requires_manual_review is False:
                query = query.eq("review_status", "not_required")
            if review_status:
                query = query.eq("review_status", review_status.strip())
            if category:
                query = query.eq("waste_taxonomy.class_code", category.strip())
            if model_version:
                query = query.eq("model_versions.model_version", model_version.strip())
            if date_from:
                query = query.gte("created_at", f"{date_from}T00:00:00Z")
            if date_to:
                query = query.lte("created_at", f"{date_to}T23:59:59Z")

            resp = (
                query.order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            rows = resp.data or []
            total = int(resp.count) if resp.count is not None else len(rows)
            resolved_map = self._fetch_resolved_class_map(client, [str(r["id"]) for r in rows])
            return [self._row_to_record_response(row, resolved_map) for row in rows], total
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to query classification history: {exc}") from exc

    def get_classification(self, classification_id: UUID) -> Optional[ClassificationRecordResponse]:
        client = self._get_client()
        try:
            resp = (
                client.table("classification_events")
                .select("*, waste_taxonomy(class_code), model_versions(model_version, preprocessing_version)")
                .eq("id", str(classification_id))
                .limit(1)
                .execute()
            )
            rows = resp.data or []
            if not rows:
                return None
            resolved_map = self._fetch_resolved_class_map(client, [str(classification_id)])
            return self._row_to_record_response(rows[0], resolved_map)
        except Exception as exc:
            raise DatabasePersistenceError(
                f"Failed to retrieve classification {classification_id}: {exc}"
            ) from exc

    def list_bin_mappings(self, jurisdiction_code: Optional[str] = None) -> List[CategoryBinMapping]:
        client = self._get_client()
        try:
            query = client.table("bin_mappings").select("*, waste_taxonomy(class_code)")
            if jurisdiction_code:
                query = query.eq("policy_reference", jurisdiction_code)
            rows = query.order("bin_code").execute().data or []
            result: List[CategoryBinMapping] = []
            for row in rows:
                taxonomy = row.get("waste_taxonomy") or {}
                result.append(
                    CategoryBinMapping(
                        jurisdiction_code=row["policy_reference"],
                        class_name=taxonomy.get("class_code", ""),
                        target_bin_code=row["bin_code"],
                        target_bin_label=row["display_name"],
                        handling_notes=row["policy_reference"],
                        verification_status=_map_db_mapping_status(row["mapping_status"]),
                    )
                )
            return result
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to query bin mappings: {exc}") from exc

    def list_approved_taxonomy(self) -> List[ApprovedTaxonomyOption]:
        client = self._get_client()
        try:
            rows = (
                client.table("waste_taxonomy")
                .select("id, class_code, display_name, taxonomy_version")
                .eq("active", True)
                .order("class_code")
                .execute()
                .data
                or []
            )
            return [
                ApprovedTaxonomyOption(
                    id=UUID(r["id"]),
                    class_code=r["class_code"],
                    display_name=r["display_name"],
                    taxonomy_version=r["taxonomy_version"],
                )
                for r in rows
            ]
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to query approved taxonomy classes: {exc}") from exc

    def _lookup_verified_bin(self, client: Any, class_code: Optional[str]) -> Optional[str]:
        if not class_code:
            return None
        rows = (
            client.table("bin_mappings")
            .select("bin_code, display_name, mapping_status, waste_taxonomy!inner(class_code)")
            .eq("mapping_status", "verified")
            .eq("waste_taxonomy.class_code", class_code)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            return None
        return f"{rows[0]['bin_code']} — {rows[0]['display_name']}"

    def _fetch_review_history(
        self, client: Any, review_id: str, classification_id: str
    ) -> List[ReviewAuditEntry]:
        rows = (
            client.table("audit_events")
            .select("*")
            .in_("entity_id", [review_id, classification_id])
            .order("created_at", desc=True)
            .execute()
            .data
            or []
        )
        entries: List[ReviewAuditEntry] = []
        for row in rows:
            after_state = row.get("after_state") or {}
            entries.append(
                ReviewAuditEntry(
                    id=UUID(row["id"]),
                    actor_id=row.get("actor_id"),
                    actor_role=after_state.get("actor_role") if isinstance(after_state, dict) else None,
                    event_type=row["event_type"],
                    entity_id=str(row["entity_id"]),
                    before_state=row.get("before_state"),
                    after_state=after_state if isinstance(after_state, dict) else None,
                    created_at=row["created_at"],
                )
            )
        return entries

    def _build_review_response(
        self,
        client: Any,
        row: Dict[str, Any],
        include_history_and_url: bool = False,
    ) -> ReviewRecordResponse:
        event = row.get("classification_events") or {}
        predicted_tax = event.get("waste_taxonomy") or {}
        model_meta = event.get("model_versions") or {}
        confirmed_tax = row.get("waste_taxonomy") or {}
        reviewer_profile = row.get("profiles") or {}

        candidates = [
            CandidatePrediction(**c) for c in (event.get("candidate_predictions") or [])
        ]
        resolved_class = confirmed_tax.get("class_code")
        queue_status = _derive_queue_status(row)

        verified_bin: Optional[str] = None
        if queue_status in ("confirmed", "relabelled") and resolved_class:
            verified_bin = self._lookup_verified_bin(client, resolved_class)

        image_path = event.get("image_object_path")
        signed_url = (
            self._create_evidence_signed_url(image_path) if include_history_and_url else None
        )
        history = (
            self._fetch_review_history(client, str(row["id"]), str(row["classification_id"]))
            if include_history_and_url
            else []
        )

        decision_raw = event.get("decision_status")
        decision_val = DecisionStatus(decision_raw) if decision_raw else None

        return ReviewRecordResponse(
            id=UUID(row["id"]),
            classification_id=UUID(row["classification_id"]),
            queue_status=queue_status,
            version=int(row.get("version") or 1),
            predicted_class=predicted_tax.get("class_code"),
            candidate_predictions=candidates,
            model_score=float(event["model_score"]) if event.get("model_score") is not None else None,
            calibrated_confidence=(
                float(event["calibrated_confidence"])
                if event.get("calibrated_confidence") is not None
                else None
            ),
            original_decision_status=decision_val,
            model_version=model_meta.get("model_version", "unknown"),
            preprocessing_version=model_meta.get("preprocessing_version"),
            review_reason=row.get("review_reason", ""),
            image_storage_path=image_path,
            image_signed_url=signed_url,
            resolved_class=resolved_class,
            verified_mapped_bin=verified_bin,
            reviewer_notes=row.get("review_reason", ""),
            reviewer_id=UUID(row["reviewer_id"]) if row.get("reviewer_id") else None,
            reviewer_display_name=reviewer_profile.get("display_name") or None,
            claimed_by=UUID(row["claimed_by"]) if row.get("claimed_by") else None,
            claimed_at=row.get("claimed_at"),
            reviewed_at=row.get("reviewed_at"),
            created_at=row["created_at"],
            approved_for_dataset_export=bool(row.get("approved_for_dataset_export", False)),
            review_history=history,
        )

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
        client = self._get_client()
        try:
            select_clause = (
                "*, "
                "waste_taxonomy!manual_reviews_confirmed_class_id_fkey(class_code), "
                "profiles!manual_reviews_reviewer_id_fkey(display_name), "
                "classification_events!inner("
                "id, decision_status, model_score, calibrated_confidence, candidate_predictions, "
                "image_object_path, created_at, "
                "waste_taxonomy(class_code), "
                "model_versions(model_version, preprocessing_version)"
                ")"
            )
            query = client.table("manual_reviews").select(select_clause)
            if queue_status is not None:
                query = query.eq("queue_status", queue_status)
            if date_from:
                query = query.gte("created_at", f"{date_from}T00:00:00Z")
            if date_to:
                query = query.lte("created_at", f"{date_to}T23:59:59Z")

            rows = query.execute().data or []
            records = [self._build_review_response(client, row, include_history_and_url=False) for row in rows]

            if predicted_category:
                needle = predicted_category.strip().lower()
                records = [
                    r for r in records if needle in (r.predicted_class or "").lower()
                ]
            if model_version:
                needle = model_version.strip().lower()
                records = [r for r in records if needle in r.model_version.lower()]
            if review_reason:
                needle = review_reason.strip().lower()
                records = [r for r in records if needle in r.review_reason.lower()]

            if sort == "oldest_first":
                records.sort(key=lambda r: r.created_at)
            elif sort == "newest_first":
                records.sort(key=lambda r: r.created_at, reverse=True)
            elif sort == "lowest_confidence_first":
                records.sort(
                    key=lambda r: (
                        r.calibrated_confidence
                        if r.calibrated_confidence is not None
                        else (r.model_score if r.model_score is not None else -1.0)
                    )
                )

            total = len(records)
            return records[offset : offset + limit], total
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to query manual reviews: {exc}") from exc

    def get_review_detail(self, classification_id: UUID) -> Optional[ReviewRecordResponse]:
        client = self._get_client()
        try:
            select_clause = (
                "*, "
                "waste_taxonomy!manual_reviews_confirmed_class_id_fkey(class_code), "
                "profiles!manual_reviews_reviewer_id_fkey(display_name), "
                "classification_events!inner("
                "id, decision_status, model_score, calibrated_confidence, candidate_predictions, "
                "image_object_path, created_at, "
                "waste_taxonomy(class_code), "
                "model_versions(model_version, preprocessing_version)"
                ")"
            )
            rows = (
                client.table("manual_reviews")
                .select(select_clause)
                .eq("classification_id", str(classification_id))
                .limit(1)
                .execute()
                .data
                or []
            )
            if not rows:
                return None
            return self._build_review_response(client, rows[0], include_history_and_url=True)
        except Exception as exc:
            raise DatabasePersistenceError(
                f"Failed to load review detail for {classification_id}: {exc}"
            ) from exc

    @staticmethod
    def _raise_mapped_rpc_error(exc: Exception) -> None:
        msg = str(exc)
        if "CONFLICT:" in msg:
            raise ReviewConflictError(msg.split("CONFLICT:", 1)[1].strip()) from exc
        if "VALIDATION:" in msg:
            raise ReviewValidationError(msg.split("VALIDATION:", 1)[1].strip()) from exc
        if "FORBIDDEN:" in msg:
            raise PermissionError(msg.split("FORBIDDEN:", 1)[1].strip()) from exc
        if "NOT_FOUND:" in msg:
            return
        raise DatabasePersistenceError(msg) from exc

    def claim_review(
        self,
        classification_id: UUID,
        reviewer_id: str,
        expected_version: Optional[int] = None,
    ) -> Optional[ReviewRecordResponse]:
        client = self._get_client()
        try:
            client.rpc(
                "claim_manual_review",
                {
                    "p_classification_id": str(classification_id),
                    "p_reviewer_id": reviewer_id,
                    "p_expected_version": expected_version,
                },
            ).execute()
            return self.get_review_detail(classification_id)
        except Exception as exc:
            if "NOT_FOUND:" in str(exc):
                return None
            self._raise_mapped_rpc_error(exc)
            return None

    def save_review_decision(
        self,
        classification_id: UUID,
        payload: ReviewSubmissionRequest,
        reviewer_id: str,
        reviewer_role: str,
    ) -> Optional[ReviewRecordResponse]:
        client = self._get_client()
        try:
            client.rpc(
                "submit_manual_review_decision",
                {
                    "p_classification_id": str(classification_id),
                    "p_reviewer_id": reviewer_id,
                    "p_action": payload.action,
                    "p_resolved_class_code": payload.resolved_class,
                    "p_reviewer_notes": payload.reviewer_notes,
                    "p_expected_version": payload.expected_version,
                    "p_approved_for_dataset_export": payload.approved_for_dataset_export,
                },
            ).execute()
            return self.get_review_detail(classification_id)
        except Exception as exc:
            if "NOT_FOUND:" in str(exc):
                return None
            self._raise_mapped_rpc_error(exc)
            return None

    def export_approved_dataset_feedback(self) -> DatasetFeedbackExportResponse:
        client = self._get_client()
        try:
            select_clause = (
                "id, classification_id, review_outcome, review_reason, reviewer_id, reviewed_at, "
                "waste_taxonomy!manual_reviews_confirmed_class_id_fkey(class_code, taxonomy_version), "
                "classification_events!inner("
                "image_object_path, "
                "waste_taxonomy(class_code), "
                "model_versions(model_version, preprocessing_version)"
                ")"
            )
            rows = (
                client.table("manual_reviews")
                .select(select_clause)
                .eq("approved_for_dataset_export", True)
                .in_("queue_status", ["confirmed", "relabelled"])
                .order("reviewed_at", desc=True)
                .execute()
                .data
                or []
            )
            items: List[DatasetFeedbackExportItem] = []
            for row in rows:
                resolved_tax = row.get("waste_taxonomy") or {}
                event = row.get("classification_events") or {}
                orig_tax = event.get("waste_taxonomy") or {}
                model_meta = event.get("model_versions") or {}
                resolved_code = resolved_tax.get("class_code")
                if not resolved_code or not row.get("reviewed_at"):
                    continue
                items.append(
                    DatasetFeedbackExportItem(
                        classification_id=UUID(row["classification_id"]),
                        review_id=UUID(row["id"]),
                        original_predicted_class=orig_tax.get("class_code"),
                        reviewer_resolved_class=resolved_code,
                        review_outcome=row["review_outcome"],
                        taxonomy_version=resolved_tax.get("taxonomy_version", "unknown"),
                        model_version=model_meta.get("model_version", "unknown"),
                        preprocessing_version=model_meta.get("preprocessing_version"),
                        image_storage_path=event.get("image_object_path", ""),
                        reviewer_id=UUID(row["reviewer_id"]) if row.get("reviewer_id") else None,
                        reviewed_at=row["reviewed_at"],
                        reviewer_notes=row.get("review_reason", ""),
                    )
                )
            return DatasetFeedbackExportResponse(
                exported_at=datetime.now(timezone.utc),
                total_approved_records=len(items),
                training_workflow_notice=(
                    "Exported explicitly approved records only. Original model predictions and reviewer labels "
                    "are preserved separately for offline, reviewed Google Colab retraining."
                ),
                items=items,
            )
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to export approved dataset feedback: {exc}") from exc

    def get_analytics_summary(self) -> AnalyticsSummaryResponse:
        client = self._get_client()
        try:
            status_rows = (
                client.table("decision_status_summary").select("*").execute().data or []
            )
            review_rows = (
                client.table("manual_review_summary").select("*").execute().data or []
            )
            counts = {
                DecisionStatus.ACCEPTED.value: 0,
                DecisionStatus.REVIEW_REQUIRED.value: 0,
                DecisionStatus.MAPPING_UNCONFIGURED.value: 0,
                DecisionStatus.REJECTED.value: 0,
            }
            for row in status_rows:
                status_val = row.get("decision_status")
                if status_val in counts:
                    counts[status_val] = int(row.get("event_count", 0))

            pending_reviews = sum(int(r.get("pending_count", 0)) for r in review_rows)
            resolved_reviews = sum(int(r.get("completed_count", 0)) for r in review_rows)
            return AnalyticsSummaryResponse(
                total_events=sum(counts.values()),
                by_decision_status=counts,
                pending_reviews=pending_reviews,
                resolved_reviews=resolved_reviews,
                source_note="Aggregated strictly from decision_status_summary and manual_review_summary PostgreSQL views.",
            )
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to compute analytics summary: {exc}") from exc

    def get_alert_thresholds(self) -> OperationalAlertThresholds:
        client = self._get_client()
        try:
            rows = (
                client.table("operational_alert_thresholds")
                .select("*")
                .eq("id", "default")
                .limit(1)
                .execute()
                .data
                or []
            )
            if not rows:
                return OperationalAlertThresholds()
            return OperationalAlertThresholds(
                pending_review_backlog_threshold=int(
                    rows[0].get("pending_review_backlog_threshold", 10)
                ),
                classification_failure_threshold=int(
                    rows[0].get("classification_failure_threshold", 3)
                ),
            )
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to read alert thresholds: {exc}") from exc

    def update_alert_thresholds(
        self, payload: OperationalAlertThresholds, actor_id: str
    ) -> OperationalAlertThresholds:
        client = self._get_client()
        try:
            client.table("operational_alert_thresholds").upsert(
                {
                    "id": "default",
                    "pending_review_backlog_threshold": payload.pending_review_backlog_threshold,
                    "classification_failure_threshold": payload.classification_failure_threshold,
                    "updated_by": actor_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).execute()
            return payload
        except Exception as exc:
            raise DatabasePersistenceError(f"Failed to update alert thresholds: {exc}") from exc

    def get_monitoring_dashboard(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        category: Optional[str] = None,
        decision_status: Optional[DecisionStatus] = None,
        model_version: Optional[str] = None,
        review_status: Optional[str] = None,
        model_loaded: bool = True,
    ) -> MonitoringDashboardResponse:
        client = self._get_client()
        try:
            resp = client.rpc(
                "get_monitoring_analytics",
                {
                    "p_date_from": date_from or None,
                    "p_date_to": date_to or None,
                    "p_category": category.strip() if category else None,
                    "p_decision_status": decision_status.value if decision_status else None,
                    "p_model_version": model_version.strip() if model_version else None,
                    "p_review_status": review_status.strip() if review_status else None,
                },
            ).execute()
            data = resp.data if isinstance(resp.data, dict) else {}

            thresh_raw = data.get("thresholds") or {}
            thresholds = OperationalAlertThresholds(
                pending_review_backlog_threshold=int(
                    thresh_raw.get("pending_review_backlog_threshold", 10)
                ),
                classification_failure_threshold=int(
                    thresh_raw.get("classification_failure_threshold", 3)
                ),
            )
            pending_backlog = int(data.get("pending_queue_backlog", 0))
            failure_count = int(data.get("failure_event_count", 0))
            unmapped = list(data.get("unmapped_categories") or [])

            alerts: List[OperationalAlertItem] = [
                OperationalAlertItem(
                    event="review_backlog",
                    severity="warning",
                    active=pending_backlog > thresholds.pending_review_backlog_threshold,
                    title="Manual Review Backlog Threshold Exceeded",
                    detail=(
                        f"{pending_backlog} pending/in-progress review(s) exceed configured threshold "
                        f"of {thresholds.pending_review_backlog_threshold}."
                        if pending_backlog > thresholds.pending_review_backlog_threshold
                        else f"Review queue backlog ({pending_backlog}) is within threshold ({thresholds.pending_review_backlog_threshold})."
                    ),
                    observed_value=pending_backlog,
                    threshold_value=thresholds.pending_review_backlog_threshold,
                ),
                OperationalAlertItem(
                    event="classification_failure",
                    severity="critical",
                    active=failure_count > thresholds.classification_failure_threshold,
                    title="Classification / Persistence Failure Threshold Exceeded",
                    detail=(
                        f"{failure_count} failure or rejected event(s) exceed configured threshold "
                        f"of {thresholds.classification_failure_threshold}."
                        if failure_count > thresholds.classification_failure_threshold
                        else f"Recorded failure/rejected events ({failure_count}) within threshold ({thresholds.classification_failure_threshold})."
                    ),
                    observed_value=failure_count,
                    threshold_value=thresholds.classification_failure_threshold,
                ),
                OperationalAlertItem(
                    event="mapping_incomplete",
                    severity="warning",
                    active=len(unmapped) > 0,
                    title="Unverified or Incomplete Category-to-Bin Mappings",
                    detail=(
                        f"Active taxonomy categories without verified mapping: {', '.join(unmapped)}."
                        if unmapped
                        else "All active taxonomy categories have verified destination mappings."
                    ),
                    observed_value=len(unmapped),
                    threshold_value=0,
                ),
                OperationalAlertItem(
                    event="model_unavailable",
                    severity="critical",
                    active=not model_loaded,
                    title="Active ONNX Classifier Unavailable",
                    detail=(
                        "FastAPI backend readiness reports that the ONNX classifier is not loaded."
                        if not model_loaded
                        else "Active ONNX classifier is loaded and ready."
                    ),
                ),
            ]

            rc = data.get("reviewed_comparison") or {}
            return MonitoringDashboardResponse(
                generated_at=datetime.now(timezone.utc),
                total_classifications=int(data.get("total_classifications", 0)),
                accepted_predictions=int(data.get("accepted_predictions", 0)),
                review_required=int(data.get("review_required", 0)),
                unconfigured_mappings=int(data.get("unconfigured_mappings", 0)),
                rejected_inputs=int(data.get("rejected_inputs", 0)),
                average_model_score=(
                    float(data["average_model_score"])
                    if data.get("average_model_score") is not None
                    else None
                ),
                average_calibrated_confidence=(
                    float(data["average_calibrated_confidence"])
                    if data.get("average_calibrated_confidence") is not None
                    else None
                ),
                calibrated_sample_count=int(data.get("calibrated_sample_count", 0)),
                total_review_records=int(data.get("total_review_records", 0)),
                resolved_review_count=int(data.get("resolved_review_count", 0)),
                review_resolution_rate=(
                    float(data["review_resolution_rate"])
                    if data.get("review_resolution_rate") is not None
                    else None
                ),
                pending_queue_backlog=pending_backlog,
                reviewed_comparison=ReviewedComparisonSummary(
                    comparison_sample_count=int(rc.get("comparison_sample_count", 0)),
                    confirmed_count=int(rc.get("confirmed_count", 0)),
                    relabelled_count=int(rc.get("relabelled_count", 0)),
                    agreement_rate_pct=(
                        float(rc["agreement_rate_pct"])
                        if rc.get("agreement_rate_pct") is not None
                        else None
                    ),
                ),
                classification_volume_over_time=[
                    DailyVolumePoint(**p)
                    for p in (data.get("classification_volume_over_time") or [])
                ],
                classification_distribution=[
                    CategoryDistributionItem(**c)
                    for c in (data.get("classification_distribution") or [])
                ],
                decision_status_distribution=[
                    DecisionDistributionItem(**d)
                    for d in (data.get("decision_status_distribution") or [])
                ],
                confidence_distribution=[
                    ConfidenceBinItem(**b) for b in (data.get("confidence_distribution") or [])
                ],
                manual_review_trends=[
                    ReviewTrendPoint(**t) for t in (data.get("manual_review_trends") or [])
                ],
                model_version_comparison=[
                    ModelComparisonItem(**m) for m in (data.get("model_version_comparison") or [])
                ],
                virtual_bin_assignments=[
                    VirtualBinAssignmentItem(**v)
                    for v in (data.get("virtual_bin_assignments") or [])
                ],
                unmapped_categories=unmapped,
                failure_event_count=failure_count,
                thresholds=thresholds,
                alerts=alerts,
                source_note=(
                    "Server-side PostgreSQL aggregation over classification_events, manual_reviews, "
                    "and model_versions. Physical sensor telemetry is excluded and marked unavailable."
                ),
            )
        except Exception as exc:
            raise DatabasePersistenceError(
                f"Failed to compute server-side monitoring analytics: {exc}"
            ) from exc

    def export_analytics_csv(
        self,
        report_type: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        category: Optional[str] = None,
        decision_status: Optional[DecisionStatus] = None,
        model_version: Optional[str] = None,
        review_status: Optional[str] = None,
        model_loaded: bool = True,
    ) -> str:
        buf = io.StringIO()
        writer = csv.writer(buf)

        if report_type == "classification_history":
            items, _ = self.list_classifications(
                decision_status=decision_status,
                category=category,
                model_version=model_version,
                review_status=review_status,
                date_from=date_from,
                date_to=date_to,
                limit=5000,
                offset=0,
            )
            writer.writerow(
                [
                    "classification_id",
                    "created_at",
                    "predicted_class",
                    "top_model_score",
                    "calibrated_confidence",
                    "decision_status",
                    "recommended_bin",
                    "review_status",
                    "reviewer_resolved_class",
                    "model_version",
                    "preprocessing_version",
                ]
            )
            for item in items:
                top = item.candidate_predictions[0] if item.candidate_predictions else None
                writer.writerow(
                    [
                        str(item.classification_id),
                        item.created_at.isoformat(),
                        item.predicted_class or "",
                        f"{top.model_score:.5f}" if top else "",
                        f"{top.calibrated_confidence:.5f}"
                        if top and top.calibrated_confidence is not None
                        else "",
                        item.decision_status.value,
                        item.recommended_bin or "",
                        item.review_status or "",
                        item.resolved_class or "",
                        item.model_version,
                        item.preprocessing_version or "",
                    ]
                )
            return buf.getvalue()

        if report_type == "manual_review":
            reviews, _ = self.list_reviews(
                predicted_category=category,
                model_version=model_version,
                date_from=date_from,
                date_to=date_to,
                sort="newest_first",
                limit=5000,
                offset=0,
            )
            writer.writerow(
                [
                    "review_id",
                    "classification_id",
                    "queue_status",
                    "original_predicted_class",
                    "reviewer_resolved_class",
                    "model_score",
                    "calibrated_confidence",
                    "model_version",
                    "reviewer_id",
                    "reviewed_at",
                    "approved_for_dataset_export",
                    "reviewer_notes",
                ]
            )
            for r in reviews:
                writer.writerow(
                    [
                        str(r.id),
                        str(r.classification_id),
                        r.queue_status,
                        r.predicted_class or "",
                        r.resolved_class or "",
                        f"{r.model_score:.5f}" if r.model_score is not None else "",
                        f"{r.calibrated_confidence:.5f}"
                        if r.calibrated_confidence is not None
                        else "",
                        r.model_version,
                        str(r.reviewer_id) if r.reviewer_id else "",
                        r.reviewed_at.isoformat() if r.reviewed_at else "",
                        str(r.approved_for_dataset_export).lower(),
                        r.reviewer_notes,
                    ]
                )
            return buf.getvalue()

        dashboard = self.get_monitoring_dashboard(
            date_from=date_from,
            date_to=date_to,
            category=category,
            decision_status=decision_status,
            model_version=model_version,
            review_status=review_status,
            model_loaded=model_loaded,
        )

        if report_type == "model_usage":
            writer.writerow(
                [
                    "model_version",
                    "framework",
                    "deployment_status",
                    "preprocessing_version",
                    "live_total_classifications",
                    "live_accepted_count",
                    "live_review_required_count",
                    "live_average_model_score",
                    "offline_training_eval_metrics",
                ]
            )
            for m in dashboard.model_version_comparison:
                writer.writerow(
                    [
                        m.model_version,
                        m.framework,
                        m.deployment_status,
                        m.preprocessing_version,
                        m.total_classifications,
                        m.accepted_count,
                        m.review_required_count,
                        f"{m.average_model_score:.4f}" if m.average_model_score is not None else "",
                        str(m.training_eval_metrics),
                    ]
                )
            return buf.getvalue()

        if report_type == "category_distribution":
            writer.writerow(
                ["class_code", "display_name", "classification_count", "percentage_pct", "accepted_count"]
            )
            for c in dashboard.classification_distribution:
                writer.writerow(
                    [c.class_code, c.display_name, c.count, f"{c.percentage:.2f}", c.accepted_count]
                )
            return buf.getvalue()

        # Default: analytics_summary (date-filtered analytics export)
        writer.writerow(["metric", "value", "notes"])
        writer.writerow(["date_from", date_from or "all", "Selected period start"])
        writer.writerow(["date_to", date_to or "all", "Selected period end"])
        writer.writerow(["total_classifications", dashboard.total_classifications, "Persisted events"])
        writer.writerow(["accepted_predictions", dashboard.accepted_predictions, "Met threshold & verified mapping"])
        writer.writerow(["review_required", dashboard.review_required, "Awaiting human review"])
        writer.writerow(["unconfigured_mappings", dashboard.unconfigured_mappings, "No verified destination mapping"])
        writer.writerow(["rejected_inputs", dashboard.rejected_inputs, "Failed upload/image validation"])
        writer.writerow(
            [
                "average_model_score",
                f"{dashboard.average_model_score:.4f}" if dashboard.average_model_score is not None else "unavailable",
                "Model score only; NOT verified accuracy",
            ]
        )
        writer.writerow(
            [
                "review_resolution_rate_pct",
                f"{dashboard.review_resolution_rate:.2f}" if dashboard.review_resolution_rate is not None else "unavailable",
                f"{dashboard.resolved_review_count}/{dashboard.total_review_records} reviewed records resolved",
            ]
        )
        writer.writerow(
            ["physical_sensor_status", "unavailable", "Hardware excluded in software-only platform"]
        )
        return buf.getvalue()

