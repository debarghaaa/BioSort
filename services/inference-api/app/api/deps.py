from fastapi import Depends, HTTPException, Request, status

from ..core.config import Settings, get_settings
from ..core.security import AuthenticatedUser, get_current_user, require_roles
from ..services.classification import ClassificationOrchestrator
from ..services.inference import ONNXClassifierService
from ..services.storage import SupabaseRepository


def get_classifier_service(request: Request) -> ONNXClassifierService:
    classifier = getattr(request.app.state, "classifier", None)
    if classifier is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Classifier service has not been initialised.",
        )
    return classifier


def get_repository(request: Request) -> SupabaseRepository:
    repo = getattr(request.app.state, "repository", None)
    if repo is None:
        settings = get_settings()
        repo = SupabaseRepository(settings)
        request.app.state.repository = repo
    return repo


def get_classification_orchestrator(
    settings: Settings = Depends(get_settings),
    classifier: ONNXClassifierService = Depends(get_classifier_service),
    repository: SupabaseRepository = Depends(get_repository),
) -> ClassificationOrchestrator:
    return ClassificationOrchestrator(
        settings=settings,
        classifier=classifier,
        repository=repository,
    )


RequireAuthenticatedUser = Depends(get_current_user)
RequireClassifierAccess = Depends(require_roles(["operator", "reviewer", "admin"]))
RequireReviewerAccess = Depends(require_roles(["reviewer", "admin"]))
