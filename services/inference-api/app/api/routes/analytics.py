from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from ...core.security import AuthenticatedUser, get_current_user, require_roles
from ...schemas.analytics import MonitoringDashboardResponse, OperationalAlertThresholds
from ...schemas.classification import AnalyticsSummaryResponse, DecisionStatus
from ...services.inference import ONNXClassifierService
from ...services.storage import DatabasePersistenceError, SupabaseRepository
from ..deps import get_classifier_service, get_repository

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/summary", response_model=AnalyticsSummaryResponse)
def get_analytics_summary(
    _user: AuthenticatedUser = Depends(get_current_user),
    repository: SupabaseRepository = Depends(get_repository),
) -> AnalyticsSummaryResponse:
    try:
        return repository.get_analytics_summary()
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/dashboard", response_model=MonitoringDashboardResponse)
def get_monitoring_dashboard(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    decision_status: Optional[DecisionStatus] = Query(default=None),
    model_version: Optional[str] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    _user: AuthenticatedUser = Depends(get_current_user),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
    repository: SupabaseRepository = Depends(get_repository),
) -> MonitoringDashboardResponse:
    try:
        return repository.get_monitoring_dashboard(
            date_from=date_from,
            date_to=date_to,
            category=category,
            decision_status=decision_status,
            model_version=model_version,
            review_status=review_status,
            model_loaded=classifier.is_ready,
        )
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/alerts/config", response_model=OperationalAlertThresholds)
def get_alert_thresholds(
    _user: AuthenticatedUser = Depends(get_current_user),
    repository: SupabaseRepository = Depends(get_repository),
) -> OperationalAlertThresholds:
    try:
        return repository.get_alert_thresholds()
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.put("/alerts/config", response_model=OperationalAlertThresholds)
def update_alert_thresholds(
    payload: OperationalAlertThresholds,
    user: AuthenticatedUser = Depends(require_roles(["admin"])),
    repository: SupabaseRepository = Depends(get_repository),
) -> OperationalAlertThresholds:
    try:
        return repository.update_alert_thresholds(payload, actor_id=user.user_id)
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/export")
def export_analytics_csv(
    report_type: Literal[
        "classification_history",
        "analytics_summary",
        "model_usage",
        "manual_review",
        "category_distribution",
    ] = Query(default="analytics_summary"),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    decision_status: Optional[DecisionStatus] = Query(default=None),
    model_version: Optional[str] = Query(default=None),
    review_status: Optional[str] = Query(default=None),
    _user: AuthenticatedUser = Depends(get_current_user),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
    repository: SupabaseRepository = Depends(get_repository),
) -> Response:
    try:
        csv_text = repository.export_analytics_csv(
            report_type=report_type,
            date_from=date_from,
            date_to=date_to,
            category=category,
            decision_status=decision_status,
            model_version=model_version,
            review_status=review_status,
            model_loaded=classifier.is_ready,
        )
        return Response(
            content=csv_text,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{report_type}_report.csv"'
            },
        )
    except DatabasePersistenceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
