from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.security import AuthenticatedUser, get_current_user
from ...schemas.classification import ModelMetadataResponse
from ...schemas.config import BinMappingsListResponse
from ...services.inference import ONNXClassifierService
from ...services.storage import DatabasePersistenceError, SupabaseRepository
from ..deps import get_classifier_service, get_repository

router = APIRouter(prefix="/api/v1", tags=["Model & Mappings"])


@router.get("/models/current", response_model=ModelMetadataResponse)
def get_current_model_metadata(
    _user: AuthenticatedUser = Depends(get_current_user),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
) -> ModelMetadataResponse:
    if (
        not classifier.is_ready
        or classifier.model_version is None
        or classifier.preprocessing_config is None
        or classifier.confidence_config is None
    ):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="; ".join(classifier.readiness_errors) or "ONNX model is not loaded.",
        )

    return ModelMetadataResponse(
        model_version=classifier.model_version,
        input_name=classifier.input_name or "",
        input_shape=classifier.input_shape,
        output_name=classifier.output_name or "",
        class_names=classifier.class_names,
        preprocessing=classifier.preprocessing_config.model_dump(),
        confidence_calibration=classifier.confidence_config.model_dump(),
    )


@router.get("/bin-mappings", response_model=BinMappingsListResponse)
def get_bin_mappings(
    jurisdiction_code: Optional[str] = Query(default=None),
    _user: AuthenticatedUser = Depends(get_current_user),
    repository: SupabaseRepository = Depends(get_repository),
) -> BinMappingsListResponse:
    try:
        items = repository.list_bin_mappings(jurisdiction_code=jurisdiction_code)
        return BinMappingsListResponse(items=items, total=len(items))
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
