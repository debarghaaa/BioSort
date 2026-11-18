from app.schemas.classification import CandidatePrediction, DecisionStatus
from app.schemas.config import (
    CategoryBinMapping,
    ConfidenceConfig,
    MappingVerificationStatus,
)
from app.services.decision_engine import evaluate_decision


def _sample_policy(require_calibrated: bool = True) -> ConfidenceConfig:
    return ConfidenceConfig(
        jurisdiction_code="TEST-JURISDICTION",
        accept_threshold=0.85,
        review_floor_threshold=0.50,
        require_calibrated_confidence=require_calibrated,
        minimum_margin_over_second=0.15,
    )


def test_unconfigured_policy_routes_to_manual_review():
    result = evaluate_decision(
        candidate_predictions=[
            CandidatePrediction(
                class_name="sharps_needle",
                model_score=0.95,
                calibrated_confidence=0.93,
            )
        ],
        model_version="mobilenetv3-test-v1",
        confidence_config=None,
        mappings=[],
    )
    assert result.decision_status == DecisionStatus.REVIEW_REQUIRED
    assert result.recommended_bin is None
    assert result.requires_manual_review is True


def test_uncalibrated_score_not_accepted_when_calibration_required():
    result = evaluate_decision(
        candidate_predictions=[
            CandidatePrediction(
                class_name="sharps_needle",
                model_score=0.99,
                calibrated_confidence=None,
            )
        ],
        model_version="mobilenetv3-test-v1",
        confidence_config=_sample_policy(require_calibrated=True),
        mappings=[],
    )
    assert result.decision_status == DecisionStatus.REVIEW_REQUIRED
    assert result.recommended_bin is None
    assert result.requires_manual_review is True


def test_unverified_mapping_never_recommends_bin():
    mappings = [
        CategoryBinMapping(
            jurisdiction_code="TEST-JURISDICTION",
            class_name="sharps_needle",
            target_bin_code="BIN-SHARPS-01",
            target_bin_label="Puncture-Resistant Sharps Receptacle",
            verification_status=MappingVerificationStatus.UNVERIFIED,
        )
    ]
    result = evaluate_decision(
        candidate_predictions=[
            CandidatePrediction(
                class_name="sharps_needle",
                model_score=0.96,
                calibrated_confidence=0.94,
            ),
            CandidatePrediction(
                class_name="general_non_infectious",
                model_score=0.04,
                calibrated_confidence=0.06,
            ),
        ],
        model_version="mobilenetv3-test-v1",
        confidence_config=_sample_policy(),
        mappings=mappings,
    )
    assert result.decision_status == DecisionStatus.MAPPING_UNCONFIGURED
    assert result.recommended_bin is None
    assert result.requires_manual_review is True


def test_verified_mapping_and_sufficient_confidence_accepts():
    mappings = [
        CategoryBinMapping(
            jurisdiction_code="TEST-JURISDICTION",
            class_name="infectious_dressing",
            target_bin_code="BIN-BIO-02",
            target_bin_label="Biohazard Regulated Bag",
            verification_status=MappingVerificationStatus.VERIFIED,
        )
    ]
    result = evaluate_decision(
        candidate_predictions=[
            CandidatePrediction(
                class_name="infectious_dressing",
                model_score=0.94,
                calibrated_confidence=0.91,
            ),
            CandidatePrediction(
                class_name="general_non_infectious",
                model_score=0.06,
                calibrated_confidence=0.09,
            ),
        ],
        model_version="mobilenetv3-test-v1",
        confidence_config=_sample_policy(),
        mappings=mappings,
    )
    assert result.decision_status == DecisionStatus.ACCEPTED
    assert result.recommended_bin == "BIN-BIO-02 — Biohazard Regulated Bag"
    assert result.requires_manual_review is False


def test_banned_outcome_terms_are_rejected():
    result = evaluate_decision(
        candidate_predictions=[
            CandidatePrediction(
                class_name="sterile_item",
                model_score=0.99,
                calibrated_confidence=0.99,
            )
        ],
        model_version="mobilenetv3-test-v1",
        confidence_config=_sample_policy(),
        mappings=[],
    )
    assert result.decision_status == DecisionStatus.REJECTED
    assert result.recommended_bin is None
    assert result.requires_manual_review is True
