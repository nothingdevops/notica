import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.schedules import Schedule, ScheduleExecution


class ScheduleRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self, active_only: bool = False) -> list[Schedule]:
        q = select(Schedule).order_by(Schedule.created_at.asc())
        if active_only:
            q = q.where(Schedule.active.is_(True))
        result = await self.db.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, schedule_id: uuid.UUID) -> Schedule | None:
        result = await self.db.execute(
            select(Schedule).where(Schedule.id == schedule_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Schedule:
        schedule = Schedule(**data)
        self.db.add(schedule)
        await self.db.commit()
        return schedule

    async def update(self, schedule: Schedule, data: dict) -> Schedule:
        for key, value in data.items():
            setattr(schedule, key, value)
        await self.db.commit()
        return schedule

    async def delete(self, schedule: Schedule) -> None:
        await self.db.delete(schedule)
        await self.db.commit()

    async def get_last_success(self, schedule_id: uuid.UUID) -> ScheduleExecution | None:
        """Last scheduled (non-forced) success — used for idempotency check."""
        result = await self.db.execute(
            select(ScheduleExecution)
            .where(
                ScheduleExecution.schedule_id == schedule_id,
                ScheduleExecution.status == "success",
            )
            .order_by(ScheduleExecution.fired_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_last_execution(self, schedule_id: uuid.UUID) -> ScheduleExecution | None:
        """Most recent execution of any type — used for display."""
        result = await self.db.execute(
            select(ScheduleExecution)
            .where(ScheduleExecution.schedule_id == schedule_id)
            .order_by(ScheduleExecution.fired_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def record_execution(
        self, schedule_id: uuid.UUID, fired_at: datetime, status: str
    ) -> ScheduleExecution:
        execution = ScheduleExecution(
            schedule_id=schedule_id, fired_at=fired_at, status=status
        )
        self.db.add(execution)
        await self.db.commit()
        return execution
