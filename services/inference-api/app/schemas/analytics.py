from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class DailyVolumePoint(BaseModel):
    date: str
    total: int
    accepted: int
    review_required: int
    mapping_unconfigured: int
    rejected: int


class CategoryDistributionItem(BaseModel):
    class_code: str
    display_name: str
    count: int
    accepted_count: int
    percentage: float


class DecisionDistributionItem(BaseModel):
    status: str
    count: int
    percentage: float


class ConfidenceBinItem(BaseModel):
    bin_index: int
    label: str
    count: int


class ReviewTrendPoint(BaseModel):
    date: str
    queued: int
    confirmed: int
    relabelled: int
    unresolved: int


class ModelComparisonItem(BaseModel):
    model_version: str
    framework: str
    deployment_status: str
    preprocessing_version: str
    total_classifications: int
    accepted_count: int
    review_required_count: int
    average_model_score: Optional[float] = None
    training_eval_metrics: Dict[str, Any] = Field(default_factory=dict)


class VirtualBinAssignmentItem(BaseModel):
    bin_code: str
    virtual_assignment_count: int
    percentage: float
    last_assigned_at: Optional[datetime] = None
    physical_sensor_status: Literal["unavailable"] = "unavailable"
    physical_fill_level_pct: Optional[float] = None


class ReviewedComparisonSummary(BaseModel):
    comparison_sample_count: int
    confirmed_count: int
    relabelled_count: int
    agreement_rate_pct: Optional[float] = None


class OperationalAlertThresholds(BaseModel):
    pending_review_backlog_threshold: int = Field(default=10, ge=1, le=10000)
    classification_failure_threshold: int = Field(default=3, ge=1, le=10000)


class OperationalAlertItem(BaseModel):
    event: Literal[
        "review_backlog",
        "classification_failure",
        "mapping_incomplete",
        "model_unavailable",
    ]
    severity: Literal["warning", "critical"]
    active: bool
    title: str
    detail: str
    observed_value: Optional[int] = None
    threshold_value: Optional[int] = None


class MonitoringDashboardResponse(BaseModel):
    generated_at: datetime
    total_classifications: int
    accepted_predictions: int
    review_required: int
    unconfigured_mappings: int
    rejected_inputs: int
    average_model_score: Optional[float] = None
    average_calibrated_confidence: Optional[float] = None
    calibrated_sample_count: int
    total_review_records: int
    resolved_review_count: int
    review_resolution_rate: Optional[float] = None
    pending_queue_backlog: int
    reviewed_comparison: ReviewedComparisonSummary
    classification_volume_over_time: List[DailyVolumePoint] = Field(default_factory=list)
    classification_distribution: List[CategoryDistributionItem] = Field(default_factory=list)
    decision_status_distribution: List[DecisionDistributionItem] = Field(default_factory=list)
    confidence_distribution: List[ConfidenceBinItem] = Field(default_factory=list)
    manual_review_trends: List[ReviewTrendPoint] = Field(default_factory=list)
    model_version_comparison: List[ModelComparisonItem] = Field(default_factory=list)
    virtual_bin_assignments: List[VirtualBinAssignmentItem] = Field(default_factory=list)
    unmapped_categories: List[str] = Field(default_factory=list)
    failure_event_count: int = 0
    thresholds: OperationalAlertThresholds
    alerts: List[OperationalAlertItem] = Field(default_factory=list)
    source_note: str
