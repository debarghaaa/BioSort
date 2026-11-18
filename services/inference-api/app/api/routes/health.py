from typing import Any, Dict, List
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from ...core.config import Settings, get_settings
from ...services.inference import ONNXClassifierService
from ...services.storage import SupabaseRepository
from ..deps import get_classifier_service, get_repository

router = APIRouter(tags=["Health & Readiness"])


@router.get("/health")
def liveness_check(settings: Settings = Depends(get_settings)) -> Dict[str, Any]:
    """Application liveness probe — independent of model or database readiness."""
    return {
        "status": "alive",
        "service": settings.app_name,
        "version": settings.app_version,
    }


@router.get("/ready")
def readiness_check(
    settings: Settings = Depends(get_settings),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
    repository: SupabaseRepository = Depends(get_repository),
) -> JSONResponse:
    """
    Readiness probe checking ONNX model loading, exported artefact validation,
    JWT verification config, CORS/storage env config, and Supabase connectivity.
    """
    errors: List[str] = list(classifier.readiness_errors)

    jwt_configured = bool(settings.supabase_jwt_secret)
    if not jwt_configured:
        errors.append("SUPABASE_JWT_SECRET is not configured.")

    if not settings.cors_origins_list:
        errors.append("ALLOWED_ORIGINS is not configured.")

    db_ok, db_error = repository.check_connection()
    if not db_ok and db_error:
        errors.append(db_error)

    ready = classifier.is_ready and jwt_configured and db_ok and bool(settings.cors_origins_list)

    payload = {
        "status": "ready" if ready else "not_ready",
        "model_loaded": classifier.is_ready,
        "model_version": classifier.model_version,
        "jwt_configured": jwt_configured,
        "supabase_connected": db_ok,
        "errors": errors,
    }
    return JSONResponse(status_code=200 if ready else 503, content=payload)
