import secrets
import uuid
from datetime import datetime, timezone
from typing import Optional

from croniter import croniter
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.jobs import Job
from app.repositories.jobs import JobRepository
from app.schemas.jobs import JobCreate, JobListItem, JobResponse, JobUpdate


def _generate_token() -> str:
    return f"ntica_{secrets.token_urlsafe(32)}"


def _is_overdue(expected_cron: Optional[str], grace_period: int, last_run_at: Optional[datetime]) -> bool:
    if not expected_cron:
        return False
    now = datetime.now(timezone.utc)
    # Nếu chưa bao giờ chạy, dùng now làm base để tìm lần chạy tiếp theo
    base = last_run_at or now
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)
    try:
        cron = croniter(expected_cron, base)
        next_expected = cron.get_next(datetime)
        if next_expected.tzinfo is None:
            next_expected = next_expected.replace(tzinfo=timezone.utc)
        from datetime import timedelta
        deadline = next_expected + timedelta(minutes=grace_period)
        return now > deadline
    except Exception:
        return False


class JobService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = JobRepository(db)

    async def list_jobs(self, active_only: bool = False) -> list[JobListItem]:
        jobs = await self.repo.get_all(active_only=active_only)
        return [await self._enrich(job) for job in jobs]

    async def get_job(self, job_id: uuid.UUID) -> JobResponse:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        return await self._enrich(job)

    async def create_job(self, data: JobCreate) -> JobResponse:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job name already exists")
        token = _generate_token()
        job_data = data.model_dump()
        job_data["token"] = token
        job = await self.repo.create(job_data)
        return await self._enrich(job)

    async def update_job(self, job_id: uuid.UUID, data: JobUpdate) -> JobResponse:
        job = await self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        # Check name conflict nếu đang đổi tên
        if data.name and data.name != job.name:
            existing = await self.repo.get_by_name(data.name)
            if existing:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Job name already exists")
        update_data = {k: v for k, v in data.model_dump().items() if v is not None}
        job = await self.repo.update(job, update_data)
        return await self._enrich(job)

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

    async def _enrich(self, job: Job) -> JobListItem:
        last_alert = await self.repo.get_last_alert(job.id)
        recent_rows = await self.repo.get_recent_alerts(job.id, limit=7)

        last_status = last_alert.status if last_alert else None
        last_run_at = last_alert.received_at if last_alert else None
        recent_statuses = [row.status for row in recent_rows]
        is_overdue = _is_overdue(job.expected_cron, job.grace_period, last_run_at)

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
