import time
from typing import Any, Optional

import httpx
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

_bearer = HTTPBearer(auto_error=False)  # auto_error=False → returns None instead of 403 when header missing
_jwks_cache: dict[str, Any] = {}
_jwks_fetched_at: float = 0.0
_JWKS_TTL: float = 600.0  # refresh every 10 minutes


def _jwks_url() -> str:
    return f"{settings.keycloak_url}/realms/{settings.keycloak_realm}/protocol/openid-connect/certs"


def _issuer() -> str:
    if settings.keycloak_issuer:
        return settings.keycloak_issuer
    return f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"


async def _get_jwks() -> dict[str, Any]:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if not _jwks_cache or (now - _jwks_fetched_at) > _JWKS_TTL:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(_jwks_url())
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_fetched_at = now
    return _jwks_cache


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer),
) -> dict[str, Any]:
    """
    FastAPI dependency — auth behavior depends on settings.sso_enabled:
    - sso_enabled=False: always pass (return {}), no token check
    - sso_enabled=True:  verify Keycloak JWT; raise 401 if missing/invalid
    """
    if not settings.sso_enabled:
        return {}

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        jwks = await _get_jwks()
        payload: dict[str, Any] = jwt.decode(
            credentials.credentials,
            jwks,
            algorithms=["RS256"],
            issuer=_issuer(),
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    # Role check — if KEYCLOAK_REQUIRED_ROLE is set, user must have it in realm_access.roles
    required_role = settings.keycloak_required_role
    if required_role:
        realm_roles: list[str] = payload.get("realm_access", {}).get("roles", [])
        if required_role not in realm_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role '{required_role}' required",
            )

    return payload
