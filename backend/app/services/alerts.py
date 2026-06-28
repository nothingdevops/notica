import asyncio
import uuid
from datetime import datetime, timezone as tz
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.jobs import Job
from app.repositories.alerts import AlertRepository
from app.schemas.alerts import AlertIngest, AlertListItem, AlertResponse
from app.schemas.common import PaginatedResponse


class AlertService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = AlertRepository(db)

    async def ingest(self, job: Job, data: AlertIngest) -> AlertResponse:
        merged_tags = {**(job.tags or {}), **(data.tags or {})}

        alert_data = {
            "job_id": job.id,
            "job_name": job.name,
            "status": data.status,
            "completion_time": data.completion_time.astimezone(tz.utc) if data.completion_time.tzinfo else data.completion_time.replace(tzinfo=tz.utc),
            "duration_sec": data.duration_sec,
            "description": data.description,
            "log_content": data.log_content,
            "tags": merged_tags,
        }
        alert = await self.repo.create(alert_data)

        # Fire-and-forget: immediate notification if job is configured for it
        if job.immediate_on and data.status in job.immediate_on and job.immediate_contacts:
            from app.services.notifications import dispatch_immediate
            alert_snapshot = {
                "job_name": alert.job_name,
                "status": alert.status,
                "completion_time": alert.completion_time,
                "duration_sec": alert.duration_sec,
                "description": alert.description,
                "log_content": alert.log_content,
            }
            asyncio.create_task(dispatch_immediate(job, alert_snapshot))

        return AlertResponse.model_validate(alert)

    async def get_list(
        self,
        job_id: Optional[uuid.UUID] = None,
        status: Optional[list[str]] = None,
        tags: Optional[dict] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse[AlertListItem]:
        size = min(size, 200)
        alerts = await self.repo.get_list(
            job_id=job_id,
            status=status,
            tags=tags,
            date_from=date_from,
            date_to=date_to,
            page=page,
            size=size,
        )
        total = await self.repo.count(
            job_id=job_id, status=status, tags=tags, date_from=date_from, date_to=date_to
        )
        items = [AlertListItem.model_validate(a) for a in alerts]
        return PaginatedResponse(items=items, total=total, page=page, size=size)

    async def get_detail(self, alert_id: uuid.UUID) -> AlertResponse:
        alert = await self.repo.get_by_id(alert_id)
        if not alert:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
        return AlertResponse.model_validate(alert)
