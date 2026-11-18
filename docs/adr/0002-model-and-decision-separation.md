# ADR-0002: Separation of ML Model Inference and Category-to-Bin Decision Engine

- **Status**: Accepted
- **Date**: 2026-11-17

## Context

Medical waste segregation rules depend on local regulatory jurisdictions and institutional compliance policies, whereas computer vision models output statistical class scores (`model_score`) over visual categories. Coupling bin labels directly inside model outputs creates regulatory risk whenever rules change or confidence is low.

## Decision

1. **Pure Visual Classification**: The ONNX model outputs only ordered `candidate_predictions` (`class_name`, `model_score`, `calibrated_confidence`).
2. **Deterministic Policy Engine**: A separate module (`decision_engine.py` on FastAPI, mirrored for policy verification in `src/lib/decisionEngine.ts`) evaluates:
   - Whether a policy is configured for the active jurisdiction.
   - Whether calibrated confidence (when required) meets `review_floor_threshold` and `accept_threshold`.
   - Whether top-1 minus top-2 margin meets `minimum_margin_over_second`.
   - Whether the `category_bin_mappings` entry has `verification_status == 'verified'`.
3. **Fail-Safe Review Routing**: Any failure in threshold, calibration, margin, or mapping verification sets `recommended_bin = null`, `requires_manual_review = true`, and routes the event to `review_required` or `mapping_unconfigured`.

## Consequences

- Regulatory mappings can be updated, verified, or deprecated without retraining the ONNX model.
- Unverified or missing mappings can never emit a definitive bin recommendation.
- Uncertain predictions remain strictly separated from `accepted` events in both API responses and PostgreSQL check constraints.
