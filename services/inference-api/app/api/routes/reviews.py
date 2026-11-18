from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from ...core.security import AuthenticatedUser, require_roles
from ...schemas.review import (
    ApprovedTaxonomyResponse,
    DatasetFeedbackExportResponse,
    ReviewQueueResponse,
    ReviewQueueStatus,
    ReviewRecordResponse,
    ReviewSortOption,
    ReviewSubmissionRequest,
)
from ...services.storage import (
    DatabasePersistenceError,
    ReviewConflictError,
    ReviewValidationError,
    SupabaseRepository,
)
from ..deps import get_repository

router = APIRouter(prefix="/api/v1/reviews", tags=["Manual Reviews"])


class ClaimReviewRequest(BaseModel):
    expected_version: Optional[int] = Field(default=None, ge=1)


@router.get("", response_model=ReviewQueueResponse)
def list_reviews(
    queue_status: Optional[ReviewQueueStatus] = Query(default=None, alias="status"),
    predicted_category: Optional[str] = Query(default=None),
    model_version: Optional[str] = Query(default=None),
    review_reason: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    sort: ReviewSortOption = Query(default="oldest_first"),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> ReviewQueueResponse:
    try:
        items, total = repository.list_reviews(
            queue_status=queue_status,
            predicted_category=predicted_category,
            model_version=model_version,
            review_reason=review_reason,
            date_from=date_from,
            date_to=date_to,
            sort=sort,
            limit=limit,
            offset=offset,
        )
        return ReviewQueueResponse(items=items, total=total)
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/taxonomy", response_model=ApprovedTaxonomyResponse)
def list_approved_taxonomy(
    _user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> ApprovedTaxonomyResponse:
    try:
        return ApprovedTaxonomyResponse(items=repository.list_approved_taxonomy())
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/export/dataset-feedback", response_model=DatasetFeedbackExportResponse)
def export_approved_dataset_feedback(
    _user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> DatasetFeedbackExportResponse:
    try:
        return repository.export_approved_dataset_feedback()
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/{classification_id}", response_model=ReviewRecordResponse)
def get_review_detail(
    classification_id: UUID,
    _user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> ReviewRecordResponse:
    try:
        record = repository.get_review_detail(classification_id)
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manual review record for classification {classification_id} was not found.",
        )
    return record


@router.post("/{classification_id}/claim", response_model=ReviewRecordResponse)
def claim_review(
    classification_id: UUID,
    payload: Optional[ClaimReviewRequest] = None,
    user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> ReviewRecordResponse:
    try:
        record = repository.claim_review(
            classification_id=classification_id,
            reviewer_id=user.user_id,
            expected_version=payload.expected_version if payload else None,
        )
    except ReviewConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DatabasePersistenceError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manual review record for classification {classification_id} was not found.",
        )
    return record


@router.post("/{classification_id}", response_model=ReviewRecordResponse)
def submit_review_decision(
    classification_id: UUID,
    payload: ReviewSubmissionRequest,
    user: AuthenticatedUser = Depends(require_roles(["reviewer", "admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> ReviewRecordResponse:
    try:
        record = repository.save_review_decision(
            classification_id=classification_id,
            payload=payload,
            reviewer_id=user.user_id,
            reviewer_role=user.role,
        )
    except ReviewConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ReviewValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manual review record for classification {classification_id} was not found.",
        )
    return record
