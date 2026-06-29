import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from croniter import croniter
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.jobs import Job
from app.repositories.jobs import JobRepository
from app.schemas.jobs import JobCreate, JobListItem, JobResponse, JobUpdate


def _generate_token() -> str:
    return f"ntica_{secrets.token_urlsafe(32)}"


def _is_overdue(
    expected_cron: Optional[str],
    grace_period: int,
    last_run_at: Optional[datetime],
    tz_str: str = "UTC",
) -> bool:
    if not expected_cron:
        return False
    tz = ZoneInfo(tz_str)
    now = datetime.now(timezone.utc)
    base = last_run_at or now
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    # Convert to display timezone so croniter interprets cron fields in local time
    base_local = base.astimezone(tz)
    try:
        cron = croniter(expected_cron, base_local)
        next_expected = cron.get_next(datetime)
        if next_expected.tzinfo is None:
            next_expected = next_expected.replace(tzinfo=tz)
        deadline = next_expected + timedelta(minutes=grace_period)
        return now > deadline
    except Exception:
        return False


class JobService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = JobRepository(db)

    async def _get_display_tz(self) -> str:
        from app.repositories.settings import SettingsRepository
        stored = await SettingsRepository(self.db).get_all()
        return str(stored.get("display_timezone") or "Asia/Ho_Chi_Minh")

    async def list_jobs(self, active_only: bool = False) -> list[JobListItem]:
        jobs = await self.repo.get_all(active_only=active_only)
        tz = await self._get_display_tz()
        return [await self._enrich(job, tz) for job in jobs]

    async def get_job(self, job_id: uuid.UUID) -> JobResponse:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        tz = await self._get_display_tz()
        return await self._enrich(job, tz)

    async def create_job(self, data: JobCreate) -> JobResponse:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job name already exists")
        token = _generate_token()
        job_data = data.model_dump()
        job_data["token"] = token
        job = await self.repo.create(job_data)
        tz = await self._get_display_tz()
        return await self._enrich(job, tz)

    async def update_job(self, job_id: uuid.UUID, data: JobUpdate) -> JobResponse:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        if data.name and data.name != job.name:
            existing = await self.repo.get_by_name(data.name)
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job name already exists")
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        job = await self.repo.update(job, update_data)
        tz = await self._get_display_tz()
        return await self._enrich(job, tz)

    async def delete_job(self, job_id: uuid.UUID) -> None:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        await self.repo.delete(job)

    async def regenerate_token(self, job_id: uuid.UUID) -> str:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        new_token = _generate_token()
        await self.repo.update_token(job, new_token)
        return new_token

    async def _enrich(self, job: Job, tz: str = "UTC") -> JobListItem:
        last_alert = await self.repo.get_last_alert(job.id)
        recent_rows = await self.repo.get_recent_alerts(job.id, limit=7)

        last_status = last_alert.status if last_alert else None
        last_run_at = last_alert.received_at if last_alert else None
        recent_statuses = [row.status for row in recent_rows]
        is_overdue = _is_overdue(job.expected_cron, job.grace_period, last_run_at, tz)

        return JobListItem(
            id=job.id,
            name=job.name,
            description=job.description,
            token=job.token,
            expected_cron=job.expected_cron,
            grace_period=job.grace_period,
            tags=job.tags,
            immediate_on=job.immediate_on or [],
            immediate_contacts=job.immediate_contacts or [],
            active=job.active,
            created_at=job.created_at,
            updated_at=job.updated_at,
            last_status=last_status,
            last_run_at=last_run_at,
            is_overdue=is_overdue,
            recent_statuses=recent_statuses,
        )
