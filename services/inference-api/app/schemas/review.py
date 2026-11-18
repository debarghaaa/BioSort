from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator

from .classification import BANNED_OUTCOME_TERMS, CandidatePrediction, DecisionStatus

ReviewQueueStatus = Literal[
    "pending",
    "in_progress",
    "confirmed",
    "relabelled",
    "unresolved",
]
ReviewAction = Literal["confirmed", "relabelled", "unresolved"]
ReviewSortOption = Literal["oldest_first", "newest_first", "lowest_confidence_first"]


class ReviewAuditEntry(BaseModel):
    id: UUID
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    event_type: str
    entity_id: str
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    created_at: datetime


class ReviewSubmissionRequest(BaseModel):
    action: ReviewAction
    resolved_class: Optional[str] = None
    reviewer_notes: str = Field(default="", max_length=2000)
    expected_version: Optional[int] = Field(default=None, ge=1)
    approved_for_dataset_export: bool = False

    @field_validator("resolved_class")
    @classmethod
    def validate_no_banned_terms(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        lowered = v.lower()
        for term in BANNED_OUTCOME_TERMS:
            if term in lowered:
                raise ValueError(f"Prohibited outcome term detected: '{term}'")
        return v.strip() or None

    @model_validator(mode="after")
    def validate_action_requirements(self) -> "ReviewSubmissionRequest":
        notes = self.reviewer_notes.strip()
        if self.action == "relabelled":
            if not self.resolved_class:
                raise ValueError("A valid approved taxonomy class is required when relabelling.")
            if len(notes) < 3:
                raise ValueError(
                    "A documented relabelling reason of at least 3 characters is required."
                )
        elif self.action == "unresolved":
            if len(notes) < 3:
                raise ValueError(
                    "A documented reason of at least 3 characters is required when marking a record unresolved."
                )
            if self.approved_for_dataset_export:
                raise ValueError(
                    "Unresolved records cannot be approved for dataset feedback export."
                )
        return self


class ReviewRecordResponse(BaseModel):
    id: UUID
    classification_id: UUID
    queue_status: ReviewQueueStatus
    version: int = 1

    # Immutable original prediction metadata
    predicted_class: Optional[str] = None
    candidate_predictions: List[CandidatePrediction] = Field(default_factory=list)
    model_score: Optional[float] = None
    calibrated_confidence: Optional[float] = None
    original_decision_status: Optional[DecisionStatus] = None
    model_version: str = "unknown"
    preprocessing_version: Optional[str] = None
    review_reason: str = ""

    # Evidence metadata (never stored as binary in DB)
    image_storage_path: Optional[str] = None
    image_signed_url: Optional[str] = None

    # Separate reviewer resolution metadata
    resolved_class: Optional[str] = None
    verified_mapped_bin: Optional[str] = None
    reviewer_notes: str = ""
    reviewer_id: Optional[UUID] = None
    reviewer_display_name: Optional[str] = None
    claimed_by: Optional[UUID] = None
    claimed_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    approved_for_dataset_export: bool = False

    # Complete append-only audit trail
    review_history: List[ReviewAuditEntry] = Field(default_factory=list)


class ReviewQueueResponse(BaseModel):
    items: List[ReviewRecordResponse]
    total: int


class ApprovedTaxonomyOption(BaseModel):
    id: UUID
    class_code: str
    display_name: str
    taxonomy_version: str


class ApprovedTaxonomyResponse(BaseModel):
    items: List[ApprovedTaxonomyOption]


class DatasetFeedbackExportItem(BaseModel):
    classification_id: UUID
    review_id: UUID
    original_predicted_class: Optional[str] = None
    reviewer_resolved_class: str
    review_outcome: Literal["confirmed", "relabelled"]
    taxonomy_version: str
    model_version: str
    preprocessing_version: Optional[str] = None
    image_storage_path: str
    reviewer_id: Optional[UUID] = None
    reviewed_at: datetime
    reviewer_notes: str


class DatasetFeedbackExportResponse(BaseModel):
    exported_at: datetime
    total_approved_records: int
    training_workflow_notice: str
    items: List[DatasetFeedbackExportItem]
