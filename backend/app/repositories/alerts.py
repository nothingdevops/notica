import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import defer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.alerts import Alert

UTC = timezone.utc


def _to_utc(dt: datetime) -> datetime:
    """Ensure datetime is UTC-aware. Treats naive datetimes as UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class AlertRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: dict) -> Alert:
        alert = Alert(**data)
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)
        return alert

    async def get_by_id(self, alert_id: uuid.UUID) -> Optional[Alert]:
        result = await self.db.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        return result.scalar_one_or_none()

    async def get_list(
        self,
        job_id: Optional[uuid.UUID] = None,
        status: Optional[list[str]] = None,
        tags: Optional[dict] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        page: int = 1,
        size: int = 50,
    ) -> list[Alert]:
        stmt = (
            select(Alert)
            .options(defer(Alert.log_content))
            .order_by(Alert.received_at.desc())
        )
        stmt = self._apply_filters(stmt, job_id, status, tags, date_from, date_to)
        stmt = stmt.offset((page - 1) * size).limit(size)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count(
        self,
        job_id: Optional[uuid.UUID] = None,
        status: Optional[list[str]] = None,
        tags: Optional[dict] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> int:
        stmt = select(func.count()).select_from(Alert)
        stmt = self._apply_filters(stmt, job_id, status, tags, date_from, date_to)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def delete_older_than_batch(
        self, cutoff: datetime, batch_size: int = 500
    ) -> int:
        from sqlalchemy import delete
        subq = (
            select(Alert.id)
            .where(Alert.received_at < _to_utc(cutoff))
            .limit(batch_size)
            .scalar_subquery()
        )
        result = await self.db.execute(
            delete(Alert).where(Alert.id.in_(subq))
        )
        await self.db.commit()
        return result.rowcount

    async def get_in_window(self, start: datetime, end: datetime) -> list[Alert]:
        """Fetch all alerts in [start, end) for digest."""
        stmt = (
            select(Alert)
            .options(defer(Alert.log_content))
            .where(Alert.received_at >= _to_utc(start), Alert.received_at < _to_utc(end))
            .order_by(Alert.received_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def _apply_filters(self, stmt, job_id, status, tags, date_from, date_to):
        if job_id:
            stmt = stmt.where(Alert.job_id == job_id)
        if status:
            stmt = stmt.where(Alert.status.in_(status))
        if tags:
            stmt = stmt.where(Alert.tags.contains(tags))
        if date_from:
            # Start of UTC day (date_from is parsed as midnight UTC by FastAPI)
            stmt = stmt.where(Alert.received_at >= _to_utc(date_from))
        if date_to:
            # Exclusive end: < start of next UTC day so the whole selected day is included
            stmt = stmt.where(Alert.received_at < _to_utc(date_to) + timedelta(days=1))
        return stmt
