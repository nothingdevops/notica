import uuid
from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db, verify_job_token
from app.db.models.jobs import Job
from app.schemas.alerts import AlertIngest, AlertListItem, AlertResponse
from app.schemas.common import PaginatedResponse
from app.services.alerts import AlertService

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED)
async def ingest_alert(
    data: AlertIngest,
    job: Job = Depends(verify_job_token),
    db: AsyncSession = Depends(get_db),
):
    # X-Job-Token auth — scripts/cron jobs use this, no JWT required
    return await AlertService(db).ingest(job, data)


@router.get("", response_model=PaginatedResponse[AlertListItem])
async def list_alerts(
    job_id: Optional[uuid.UUID] = Query(None),
    status: Optional[List[str]] = Query(None),
    tags: Optional[str] = Query(None, description='JSON string, e.g. {"env":"prod"}'),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    import json
    parsed_tags = json.loads(tags) if tags else None
    return await AlertService(db).get_list(
        job_id=job_id,
        status=status,
        tags=parsed_tags,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    return await AlertService(db).get_detail(alert_id)
