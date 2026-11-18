from contextlib import asynccontextmanager
from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes import analytics, classifications, health, models, reviews
from .core.config import Settings, get_settings
from .core.logging import configure_logging, get_logger, request_id_ctx
from .core.rate_limit import RateLimitMiddleware
from .services.inference import ONNXClassifierService
from .services.storage import SupabaseRepository

logger = get_logger(__name__)


def create_app(settings_override: Settings | None = None) -> FastAPI:
    settings = settings_override or get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        env_errors = settings.validate_startup_environment()
        application.state.startup_env_errors = env_errors
        if env_errors:
            logger.warning(
                "Backend startup environment validation reported missing configuration",
                extra={"extra_fields": {"errors": env_errors}},
            )

        classifier = ONNXClassifierService()
        classifier.load_from_settings(settings)
        application.state.classifier = classifier
        application.state.repository = SupabaseRepository(settings)
        logger.info(
            "FastAPI startup complete",
            extra={
                "extra_fields": {
                    "model_loaded": classifier.is_ready,
                    "model_version": classifier.model_version,
                    "env_valid": len(env_errors) == 0,
                }
            },
        )
        yield
        logger.info("FastAPI shutdown complete")

    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "Assistive medical waste image classification and recordkeeping service. "
            "Not authorization to handle or dispose of waste."
        ),
        lifespan=lifespan,
    )

    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        req_id = request.headers.get("X-Request-ID") or str(uuid4())
        token = request_id_ctx.set(req_id)
        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx.reset(token)

    application.add_middleware(RateLimitMiddleware, settings=settings)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list or ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "Request validation failed.",
                "errors": exc.errors(),
                "request_id": request_id_ctx.get("-"),
            },
        )

    application.include_router(health.router)
    application.include_router(classifications.router)
    application.include_router(models.router)
    application.include_router(reviews.router)
    application.include_router(analytics.router)

    return application


app = create_app()
