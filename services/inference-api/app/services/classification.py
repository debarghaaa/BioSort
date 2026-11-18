from typing import Optional
from fastapi import UploadFile

from ..core.config import Settings
from ..core.logging import get_logger
from ..core.security import AuthenticatedUser
from ..schemas.classification import SharedClassificationResult
from ..schemas.config import ConfidenceConfig
from .decision_engine import evaluate_decision
from .inference import ONNXClassifierService
from .preprocessing import preprocess_image, read_upload_safely, validate_image_bytes
from .storage import SupabaseRepository

logger = get_logger(__name__)


class ClassificationOrchestrator:
    """
    Coordinates the end-to-end 11-step classification sequence:
    receive -> validate -> preprocess -> ONNX inference -> rank -> calibrate ->
    threshold check -> mapping check -> decision status -> upload & persist -> respond.
    """

    def __init__(
        self,
        settings: Settings,
        classifier: ONNXClassifierService,
        repository: SupabaseRepository,
    ) -> None:
        self.settings = settings
        self.classifier = classifier
        self.repository = repository

    async def process_upload(
        self,
        upload: UploadFile,
        user: AuthenticatedUser,
        jurisdiction_code: Optional[str] = None,
    ) -> SharedClassificationResult:
        # 1. Receive & safely stream uploaded bytes
        raw_bytes = await read_upload_safely(upload, self.settings)

        # 2. Validate encoding, MIME, dimensions, and compute SHA-256
        validated = validate_image_bytes(raw_bytes, self.settings)

        # 3. Apply exact exported preprocessing configuration
        assert self.classifier.preprocessing_config is not None
        assert self.classifier.model_version is not None
        tensor = preprocess_image(validated.rgb_image, self.classifier.preprocessing_config)

        # 4-6. Run ONNX inference, rank candidates, apply calibration
        candidates = self.classifier.predict(tensor)

        # 7-9. Load active policy/mappings from PostgreSQL and evaluate decision
        db_policy, mappings = self.repository.load_policy_and_mappings(jurisdiction_code)
        effective_policy = self._merge_confidence_policy(
            self.classifier.confidence_config,
            db_policy,
            jurisdiction_code,
        )
        result = evaluate_decision(
            candidate_predictions=candidates,
            model_version=self.classifier.model_version,
            confidence_config=effective_policy,
            mappings=mappings,
            jurisdiction_override=jurisdiction_code,
        )

        # 10. Upload private evidence image & persist classification event
        storage_path = self.repository.upload_evidence_image(
            classification_id=result.classification_id,
            image=validated,
            owner_id=user.user_id,
        )
        self.repository.save_classification_event(
            result=result,
            image=validated,
            image_filename=upload.filename,
            storage_path=storage_path,
            jurisdiction_code=(
                jurisdiction_code
                or (effective_policy.jurisdiction_code if effective_policy else None)
            ),
            policy_snapshot=effective_policy.model_dump() if effective_policy else {},
            uploaded_by=user.user_id,
            actor_role=user.role,
        )

        logger.info(
            "Classification completed and persisted",
            extra={
                "extra_fields": {
                    "classification_id": str(result.classification_id),
                    "decision_status": result.decision_status.value,
                    "model_version": result.model_version,
                }
            },
        )
        # 11. Return canonical SharedClassificationResult
        return result

    @staticmethod
    def _merge_confidence_policy(
        artefact_conf: Optional[ConfidenceConfig],
        db_policy: Optional[ConfidenceConfig],
        jurisdiction_override: Optional[str],
    ) -> Optional[ConfidenceConfig]:
        if db_policy is not None:
            if artefact_conf is not None:
                return db_policy.model_copy(update={"calibration": artefact_conf.calibration})
            return db_policy
        if artefact_conf is not None:
            if jurisdiction_override:
                return artefact_conf.model_copy(update={"jurisdiction_code": jurisdiction_override})
            return artefact_conf
        return None
