from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.config import settings as config
from app.core.dependencies import get_db
from app.repositories.settings import SettingsRepository
from app.schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])

DEFAULTS = {
    "retention_days": 90,
    "app_url": config.app_url,
    "display_timezone": "Asia/Ho_Chi_Minh",
    "organization_name": "Notica",
}


async def _load(db: AsyncSession) -> SettingsResponse:
    stored = await SettingsRepository(db).get_all()
    return SettingsResponse(
        retention_days=int(stored.get("retention_days", DEFAULTS["retention_days"])),
        app_url=str(stored.get("app_url", DEFAULTS["app_url"])),
        display_timezone=str(stored.get("display_timezone", DEFAULTS["display_timezone"])),
        organization_name=str(stored.get("organization_name", DEFAULTS["organization_name"])),
        has_logo=bool(stored.get("logo_data")),
        has_favicon=bool(stored.get("favicon_data")),
    )


@router.get("", response_model=SettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await _load(db)


@router.put("", response_model=SettingsResponse)
async def update_settings(
    data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    repo = SettingsRepository(db)
    if data.retention_days is not None:
        await repo.set("retention_days", data.retention_days)
    if data.app_url is not None:
        await repo.set("app_url", data.app_url)
    if data.display_timezone is not None:
        await repo.set("display_timezone", data.display_timezone)
    if data.organization_name is not None:
        await repo.set("organization_name", data.organization_name)
    return await _load(db)
