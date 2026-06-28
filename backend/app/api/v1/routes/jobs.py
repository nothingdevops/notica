import uuid
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.schemas.alerts import AlertListItem
from app.schemas.common import PaginatedResponse
from app.schemas.jobs import JobCreate, JobListItem, JobResponse, JobUpdate, TokenResponse
from app.services.alerts import AlertService
from app.services.jobs import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=List[JobListItem])
async def list_jobs(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await JobService(db).list_jobs(active_only=active_only)


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    data: JobCreate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await JobService(db).create_job(data)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await JobService(db).get_job(job_id)


@router.put("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: uuid.UUID,
    data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await JobService(db).update_job(job_id, data)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    await JobService(db).delete_job(job_id)


@router.post("/{job_id}/regenerate-token", response_model=TokenResponse)
async def regenerate_token(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    new_token = await JobService(db).regenerate_token(job_id)
    return TokenResponse(token=new_token)


@router.get("/{job_id}/alerts", response_model=PaginatedResponse[AlertListItem])
async def get_job_alerts(
    job_id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await AlertService(db).get_list(job_id=job_id, page=page, size=size)
