from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from ..schemas.classification import (
    BANNED_OUTCOME_TERMS,
    CandidatePrediction,
    DecisionStatus,
    SharedClassificationResult,
)
from ..schemas.config import (
    CategoryBinMapping,
    ConfidenceConfig,
    MappingVerificationStatus,
)


def _contains_banned_term(text: Optional[str]) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(term in lowered for term in BANNED_OUTCOME_TERMS)


def evaluate_decision(
    candidate_predictions: List[CandidatePrediction],
    model_version: str,
    confidence_config: Optional[ConfidenceConfig],
    mappings: List[CategoryBinMapping],
    jurisdiction_override: Optional[str] = None,
) -> SharedClassificationResult:
    """
    Deterministic Policy & Category-to-Bin Decision Engine.
    - Never invents confidence thresholds.
    - Never treats uncalibrated model_score as calibrated probability when calibration is required.
    - Never recommends a destination bin for unverified or missing mappings.
    - Routes uncertain predictions to manual review.
    """
    now = datetime.now(timezone.utc)
    classification_id = uuid4()

    if not candidate_predictions:
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=None,
            candidate_predictions=[],
            decision_status=DecisionStatus.REJECTED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason="Classifier returned no candidate predictions.",
            model_version=model_version,
            created_at=now,
        )

    ordered = sorted(candidate_predictions, key=lambda c: c.model_score, reverse=True)
    top = ordered[0]
    second_score = ordered[1].model_score if len(ordered) > 1 else 0.0

    if _contains_banned_term(top.class_name):
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=None,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.REJECTED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason="Predicted class contains prohibited terminology.",
            model_version=model_version,
            created_at=now,
        )

    if confidence_config is None or confidence_config.accept_threshold is None:
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.REVIEW_REQUIRED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason="Confidence threshold policy is not configured; manual review required.",
            model_version=model_version,
            created_at=now,
        )

    if confidence_config.require_calibrated_confidence:
        if top.calibrated_confidence is None:
            return SharedClassificationResult(
                classification_id=classification_id,
                predicted_class=top.class_name,
                candidate_predictions=ordered,
                decision_status=DecisionStatus.REVIEW_REQUIRED,
                recommended_bin=None,
                requires_manual_review=True,
                review_reason="Policy requires calibrated confidence, which is not configured for this model.",
                model_version=model_version,
                created_at=now,
            )
        effective_confidence = top.calibrated_confidence
    else:
        effective_confidence = (
            top.calibrated_confidence
            if top.calibrated_confidence is not None
            else top.model_score
        )

    if (
        confidence_config.review_floor_threshold is not None
        and effective_confidence < confidence_config.review_floor_threshold
    ):
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.REVIEW_REQUIRED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason=(
                f"Confidence {effective_confidence:.3f} is below review floor "
                f"{confidence_config.review_floor_threshold:.3f}."
            ),
            model_version=model_version,
            created_at=now,
        )

    margin = top.model_score - second_score
    if (
        effective_confidence < confidence_config.accept_threshold
        or margin < confidence_config.minimum_margin_over_second
    ):
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.REVIEW_REQUIRED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason=(
                f"Confidence {effective_confidence:.3f} (threshold {confidence_config.accept_threshold:.3f}) "
                f"or top-2 margin {margin:.3f} requires manual review."
            ),
            model_version=model_version,
            created_at=now,
        )

    target_jurisdiction = (
        jurisdiction_override or confidence_config.jurisdiction_code or ""
    ).strip()

    if not target_jurisdiction:
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.MAPPING_UNCONFIGURED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason="No regulatory jurisdiction code configured for bin mapping lookup.",
            model_version=model_version,
            created_at=now,
        )

    matching_mapping = next(
        (
            m
            for m in mappings
            if m.jurisdiction_code.upper() == target_jurisdiction.upper()
            and m.class_name == top.class_name
        ),
        None,
    )

    if (
        matching_mapping is None
        or matching_mapping.verification_status != MappingVerificationStatus.VERIFIED
    ):
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.MAPPING_UNCONFIGURED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason=(
                f"Destination mapping for '{top.class_name}' in jurisdiction "
                f"'{target_jurisdiction}' is missing or unverified."
            ),
            model_version=model_version,
            created_at=now,
        )

    if _contains_banned_term(matching_mapping.target_bin_code) or _contains_banned_term(
        matching_mapping.target_bin_label
    ):
        return SharedClassificationResult(
            classification_id=classification_id,
            predicted_class=top.class_name,
            candidate_predictions=ordered,
            decision_status=DecisionStatus.REJECTED,
            recommended_bin=None,
            requires_manual_review=True,
            review_reason="Configured bin label contains prohibited terminology.",
            model_version=model_version,
            created_at=now,
        )

    return SharedClassificationResult(
        classification_id=classification_id,
        predicted_class=top.class_name,
        candidate_predictions=ordered,
        decision_status=DecisionStatus.ACCEPTED,
        recommended_bin=f"{matching_mapping.target_bin_code} — {matching_mapping.target_bin_label}",
        requires_manual_review=False,
        review_reason=None,
        model_version=model_version,
        created_at=now,
    )
