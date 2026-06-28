from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.alerts import Alert
from app.db.models.jobs import Job
from app.schemas.analytics import (
    DailyDurationPoint,
    DailyStatusPoint,
    JobStatsResponse,
    OverviewResponse,
    TopFailingJob,
)

UTC = timezone.utc
STATUSES = ("success", "failure", "warning", "skipped")
_DAY = text("'day'")  # literal for date_trunc; avoids parameterized GROUP BY mismatch


def _cutoff(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def _iso_day(dt: datetime) -> str:
    """Convert datetime to YYYY-MM-DD string (UTC)."""
    return dt.astimezone(UTC).strftime("%Y-%m-%d")


def _trunc_day(col):
    return func.date_trunc(_DAY, col)


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_job_stats(self, job_id: uuid.UUID, period_days: int) -> JobStatsResponse:
        since = _cutoff(period_days)

        # --- Daily status counts ---
        rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.job_id == job_id, Alert.received_at >= since)
            .group_by(_trunc_day(Alert.received_at), Alert.status)
            .order_by(_trunc_day(Alert.received_at))
        )
        bucket: dict[str, dict[str, int]] = defaultdict(lambda: {s: 0 for s in STATUSES})
        total = 0
        success_count = 0
        for row in rows:
            day_str = _iso_day(row.day)
            bucket[day_str][row.status] = row.cnt
            total += row.cnt
            if row.status == "success":
                success_count += row.cnt

        daily_status = [
            DailyStatusPoint(day=d, **counts) for d, counts in sorted(bucket.items())
        ]
        success_rate = round(success_count * 100.0 / total, 1) if total else 0.0

        # --- Daily avg duration ---
        dur_rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                func.avg(Alert.duration_sec).label("avg_dur"),
            )
            .where(
                Alert.job_id == job_id,
                Alert.received_at >= since,
                Alert.duration_sec.is_not(None),
            )
            .group_by(_trunc_day(Alert.received_at))
            .order_by(_trunc_day(Alert.received_at))
        )
        daily_duration = [
            DailyDurationPoint(
                day=_iso_day(r.day),
                avg_duration=round(float(r.avg_dur), 1) if r.avg_dur is not None else None,
            )
            for r in dur_rows
        ]

        return JobStatsResponse(
            job_id=job_id,
            period_days=period_days,
            success_rate=success_rate,
            total_runs=total,
            daily_status=daily_status,
            daily_duration=daily_duration,
        )

    async def get_overview(self) -> OverviewResponse:
        since = _cutoff(7)

        # --- Job counts ---
        job_counts = await self.db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Job.active == True).label("active"),  # noqa: E712
            ).select_from(Job)
        )
        jc = job_counts.one()

        # --- System-wide daily status (7d) ---
        rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.received_at >= since)
            .group_by(_trunc_day(Alert.received_at), Alert.status)
            .order_by(_trunc_day(Alert.received_at))
        )
        bucket: dict[str, dict[str, int]] = defaultdict(lambda: {s: 0 for s in STATUSES})
        total_7d = 0
        success_7d = 0
        for row in rows:
            day_str = _iso_day(row.day)
            bucket[day_str][row.status] = row.cnt
            total_7d += row.cnt
            if row.status == "success":
                success_7d += row.cnt

        daily_status = [
            DailyStatusPoint(day=d, **counts) for d, counts in sorted(bucket.items())
        ]
        success_rate_7d = round(success_7d * 100.0 / total_7d, 1) if total_7d else 0.0

        # --- Top 5 failing jobs (7d) ---
        top_rows = await self.db.execute(
            select(Alert.job_name, func.count().label("cnt"))
            .where(Alert.status == "failure", Alert.received_at >= since)
            .group_by(Alert.job_name)
            .order_by(func.count().desc())
            .limit(5)
        )
        top_failing = [
            TopFailingJob(job_name=r.job_name, failure_count=r.cnt) for r in top_rows
        ]

        return OverviewResponse(
            total_jobs=jc.total,
            active_jobs=jc.active,
            success_rate_7d=success_rate_7d,
            total_alerts_7d=total_7d,
            daily_status=daily_status,
            top_failing_jobs=top_failing,
        )
