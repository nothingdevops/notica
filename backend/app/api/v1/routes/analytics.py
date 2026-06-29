import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import JobStatsResponse, OverviewResponse

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    period: int = Query(7, ge=1, le=90, description="Period in days: 7, 30, or 90"),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
) -> OverviewResponse:
    return await AnalyticsRepository(db).get_overview(period_days=period)


@router.get("/jobs/{job_id}", response_model=JobStatsResponse)
async def get_job_stats(
    job_id: uuid.UUID,
    period: int = Query(7, ge=1, le=90, description="Period in days: 7, 30, or 90"),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
) -> JobStatsResponse:
    return await AnalyticsRepository(db).get_job_stats(job_id, period_days=period)
