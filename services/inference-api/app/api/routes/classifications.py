from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status

from ...core.security import AuthenticatedUser, get_current_user, require_roles
from ...schemas.classification import (
    ClassificationListResponse,
    ClassificationRecordResponse,
    DecisionStatus,
    SharedClassificationResult,
)
from ...services.classification import ClassificationOrchestrator
from ...services.inference import ModelNotReadyError, ONNXClassifierService
from ...services.preprocessing import ImageValidationError
from ...services.storage import (
    DatabasePersistenceError,
    StorageIntegrationError,
    SupabaseRepository,
)
from ..deps import (
    get_classification_orchestrator,
    get_classifier_service,
    get_repository,
)

router = APIRouter(prefix="/api/v1/classifications", tags=["Classifications"])


@router.post("", response_model=SharedClassificationResult)
async def create_classification(
    file: UploadFile = File(...),
    jurisdiction_code: Optional[str] = Form(default=None),
    user: AuthenticatedUser = Depends(require_roles(["operator", "reviewer", "admin"])),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
    orchestrator: ClassificationOrchestrator = Depends(get_classification_orchestrator),
) -> SharedClassificationResult:
    if not classifier.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="; ".join(classifier.readiness_errors) or "ONNX classifier is not ready.",
        )

    try:
        return await orchestrator.process_upload(
            upload=file,
            user=user,
            jurisdiction_code=jurisdiction_code,
        )
    except ImageValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "message": str(exc),
                "decision_status": DecisionStatus.REJECTED.value,
            },
        ) from exc
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except StorageIntegrationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evidence storage failure; classification was not saved: {exc}",
        ) from exc
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Database persistence failure; classification was not saved: {exc}",
        ) from exc


@router.get("", response_model=ClassificationListResponse)
def list_classifications(
    decision_status: Optional[DecisionStatus] = Query(default=None),
    requires_manual_review: Optional[bool] = Query(default=None),
    category: Optional[str] = Query(default=None),
    model_version: Optional[str] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: AuthenticatedUser = Depends(get_current_user),
    repository: SupabaseRepository = Depends(get_repository),
) -> ClassificationListResponse:
    try:
        items, total = repository.list_classifications(
            decision_status=decision_status,
            requires_manual_review=requires_manual_review,
            category=category,
            model_version=model_version,
            review_status=review_status,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        return ClassificationListResponse(
            items=items,
            total=total,
            limit=limit,
            offset=offset,
        )
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/{classification_id}", response_model=ClassificationRecordResponse)
def get_classification_detail(
    classification_id: UUID,
    _user: AuthenticatedUser = Depends(get_current_user),
    repository: SupabaseRepository = Depends(get_repository),
) -> ClassificationRecordResponse:
    try:
        record = repository.get_classification(classification_id)
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Classification event {classification_id} was not found.",
        )
    return record
