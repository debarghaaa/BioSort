from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

BANNED_OUTCOME_TERMS = ("safe", "sterile", "medically approved")


class DecisionStatus(str, Enum):
    ACCEPTED = "accepted"
    REVIEW_REQUIRED = "review_required"
    MAPPING_UNCONFIGURED = "mapping_unconfigured"
    REJECTED = "rejected"


class CandidatePrediction(BaseModel):
    class_name: str
    model_score: float = Field(..., ge=0.0, le=1.0)
    calibrated_confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class SharedClassificationResult(BaseModel):
    classification_id: UUID
    predicted_class: Optional[str] = None
    candidate_predictions: List[CandidatePrediction] = Field(default_factory=list)
    decision_status: DecisionStatus
    recommended_bin: Optional[str] = None
    requires_manual_review: bool
    review_reason: Optional[str] = None
    model_version: str
    created_at: datetime

    @field_validator("predicted_class", "recommended_bin")
    @classmethod
    def validate_no_banned_terms(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        lowered = v.lower()
        for term in BANNED_OUTCOME_TERMS:
            if term in lowered:
                raise ValueError(f"Prohibited outcome term detected: '{term}'")
        return v


class ClassificationRecordResponse(SharedClassificationResult):
    jurisdiction_code: Optional[str] = None
    image_filename: Optional[str] = None
    image_storage_path: Optional[str] = None
    image_sha256: Optional[str] = None
    image_mime_type: Optional[str] = None
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    review_status: Optional[str] = None
    resolved_class: Optional[str] = None
    preprocessing_version: Optional[str] = None


class ClassificationListResponse(BaseModel):
    items: List[ClassificationRecordResponse]
    total: int
    limit: int
    offset: int


class ModelMetadataResponse(BaseModel):
    model_version: str
    input_name: str
    input_shape: List[Optional[int]]
    output_name: str
    class_names: List[str]
    preprocessing: Dict[str, object]
    confidence_calibration: Dict[str, object]


class AnalyticsSummaryResponse(BaseModel):
    total_events: int
    by_decision_status: Dict[str, int]
    pending_reviews: int
    resolved_reviews: int
    source_note: str
