import base64
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.repositories.settings import SettingsRepository

router = APIRouter(prefix="/assets", tags=["assets"])

_LOGO_MAX_BYTES = 500 * 1024   # 500 KB
_FAVICON_MAX_BYTES = 50 * 1024  # 50 KB

_LOGO_ALLOWED = {"image/png", "image/jpeg", "image/svg+xml"}
_FAVICON_ALLOWED = {"image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"}


async def _upload(
    file: UploadFile,
    allowed_types: set[str],
    max_bytes: int,
    data_key: str,
    mime_key: str,
    db: AsyncSession,
) -> None:
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported type '{content_type}'. Allowed: {', '.join(sorted(allowed_types))}",
        )
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(data)} bytes). Max: {max_bytes} bytes",
        )
    repo = SettingsRepository(db)
    await repo.set(data_key, base64.b64encode(data).decode())
    await repo.set(mime_key, content_type)


async def _serve(data_key: str, mime_key: str, db: AsyncSession) -> Response:
    repo = SettingsRepository(db)
    data_b64 = await repo.get(data_key)
    mime = await repo.get(mime_key)
    if not data_b64:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return Response(
        content=base64.b64decode(str(data_b64)),
        media_type=str(mime or "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=3600"},
    )


# ── Logo ──────────────────────────────────────────────────────────────────────

@router.post("/logo", status_code=status.HTTP_204_NO_CONTENT)
async def upload_logo(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    await _upload(file, _LOGO_ALLOWED, _LOGO_MAX_BYTES, "logo_data", "logo_mime", db)


@router.get("/logo")
async def get_logo(db: AsyncSession = Depends(get_db)):
    return await _serve("logo_data", "logo_mime", db)


@router.delete("/logo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_logo(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    repo = SettingsRepository(db)
    await repo.delete("logo_data")
    await repo.delete("logo_mime")


# ── Favicon ───────────────────────────────────────────────────────────────────

@router.post("/favicon", status_code=status.HTTP_204_NO_CONTENT)
async def upload_favicon(
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    await _upload(file, _FAVICON_ALLOWED, _FAVICON_MAX_BYTES, "favicon_data", "favicon_mime", db)


@router.get("/favicon")
async def get_favicon(db: AsyncSession = Depends(get_db)):
    return await _serve("favicon_data", "favicon_mime", db)


@router.delete("/favicon", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favicon(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    repo = SettingsRepository(db)
    await repo.delete("favicon_data")
    await repo.delete("favicon_mime")
