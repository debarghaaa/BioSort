from functools import lru_cache
from typing import List, Optional
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "AI Medical Waste Segregation Inference & Policy API"
    app_version: str = "0.2.0"
    app_env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    allowed_origins: str = "http://localhost:3000"

    # Explicit ONNX model & exported artefact paths
    model_path: Optional[str] = None
    class_names_path: Optional[str] = None
    preprocessing_config_path: Optional[str] = None
    confidence_config_path: Optional[str] = None
    model_version: Optional[str] = None

    # Server-only Supabase configuration
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    supabase_jwt_secret: Optional[str] = None
    supabase_storage_bucket: str = Field(
        default="waste-evidence",
        validation_alias=AliasChoices("SUPABASE_STORAGE_BUCKET", "SUPABASE_EVIDENCE_BUCKET"),
    )

    # Strict image validation constraints
    max_image_bytes: int = 10 * 1024 * 1024
    min_image_width: int = 64
    min_image_height: int = 64
    max_image_width: int = 8192
    max_image_height: int = 8192

    # Rate limiting configuration
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    default_jurisdiction_code: Optional[str] = None

    @property
    def supabase_evidence_bucket(self) -> str:
        """Backward-compatible accessor for storage bucket name."""
        return self.supabase_storage_bucket

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    def validate_startup_environment(self) -> List[str]:
        """
        Validate presence of required backend environment variables during startup
        without exposing credential values in logs or error payloads.
        """
        checks = {
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
            "SUPABASE_JWT_SECRET": self.supabase_jwt_secret,
            "SUPABASE_STORAGE_BUCKET": self.supabase_storage_bucket,
            "MODEL_PATH": self.model_path,
            "CLASS_NAMES_PATH": self.class_names_path,
            "PREPROCESSING_CONFIG_PATH": self.preprocessing_config_path,
            "CONFIDENCE_CONFIG_PATH": self.confidence_config_path,
            "MODEL_VERSION": self.model_version,
            "ALLOWED_ORIGINS": self.allowed_origins,
        }
        missing = [name for name, val in checks.items() if not val or not str(val).strip()]
        errors: List[str] = []
        if missing:
            errors.append(
                f"Missing required backend environment variables: {', '.join(missing)}."
            )
        if not self.cors_origins_list:
            errors.append("ALLOWED_ORIGINS must specify at least one explicit origin.")
        return errors


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
