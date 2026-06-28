import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.alerts import Alert
from app.db.models.jobs import Job


class JobRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self, active_only: bool = False) -> list[Job]:
        stmt = select(Job)
        if active_only:
            stmt = stmt.where(Job.active.is_(True))
        stmt = stmt.order_by(Job.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, job_id: uuid.UUID) -> Optional[Job]:
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Optional[Job]:
        result = await self.db.execute(select(Job).where(Job.name == name))
        return result.scalar_one_or_none()

    async def get_by_token(self, token: str) -> Optional[Job]:
        result = await self.db.execute(
            select(Job).where(Job.token == token, Job.active.is_(True))
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Job:
        job = Job(**data)
        self.db.add(job)
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def update(self, job: Job, data: dict) -> Job:
        for key, value in data.items():
            setattr(job, key, value)
        job.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def delete(self, job: Job) -> None:
        await self.db.delete(job)
        await self.db.commit()

    async def update_token(self, job: Job, new_token: str) -> Job:
        job.token = new_token
        job.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(job)
        return job

    async def get_last_alert(self, job_id: uuid.UUID) -> Optional[Alert]:
        result = await self.db.execute(
            select(Alert)
            .where(Alert.job_id == job_id)
            .order_by(Alert.received_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_recent_alerts(self, job_id: uuid.UUID, limit: int = 7) -> list[Alert]:
        result = await self.db.execute(
            select(Alert.status, Alert.received_at)
            .where(Alert.job_id == job_id)
            .order_by(Alert.received_at.desc())
            .limit(limit)
        )
        return list(result.all())
