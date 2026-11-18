from dataclasses import dataclass
from typing import Iterable, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings
from .logging import get_logger

logger = get_logger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)

VALID_ROLES = {"operator", "reviewer", "admin"}


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: Optional[str]
    role: str


def decode_supabase_jwt(token: str, settings: Settings) -> AuthenticatedUser:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication verification is not configured on this service (SUPABASE_JWT_SECRET missing).",
        )

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["sub", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = str(claims.get("sub", "")).strip()
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    app_meta = claims.get("app_metadata") or {}
    user_meta = claims.get("user_metadata") or {}
    raw_role = (
        claims.get("app_role")
        or app_meta.get("role")
        or user_meta.get("role")
        or "operator"
    )
    normalized_role = str(raw_role).lower()
    if normalized_role not in VALID_ROLES:
        normalized_role = "operator"

    return AuthenticatedUser(
        user_id=user_id,
        email=claims.get("email"),
        role=normalized_role,
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decode_supabase_jwt(credentials.credentials, settings)


def require_roles(allowed_roles: Iterable[str]):
    allowed = {r.lower() for r in allowed_roles}

    def _dependency(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role.lower() not in allowed:
            logger.warning(
                "Authorisation denied",
                extra={"extra_fields": {"user_id": user.user_id, "role": user.role}},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorised for this operation.",
            )
        return user

    return _dependency
