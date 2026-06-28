from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/sso-config", tags=["sso"])


@router.get("")
async def get_sso_config():
    if not settings.sso_enabled:
        return {"enabled": False}
    return {
        "enabled": True,
        "keycloak_url": settings.keycloak_url,
        "realm": settings.keycloak_realm,
        "client_id": settings.keycloak_client_id,
    }
