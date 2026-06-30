import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from croniter import croniter
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.jobs import Job
from app.repositories.alerts import AlertRepository
from app.repositories.jobs import JobRepository
from app.repositories.settings import SettingsRepository

logger = logging.getLogger(__name__)

UTC = timezone.utc


class OverdueDetectionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.job_repo = JobRepository(db)
        self.alert_repo = AlertRepository(db)

    async def scan_all(self) -> None:
        stored = await SettingsRepository(self.db).get_all()
        tz_str = str(stored.get("display_timezone") or "Asia/Ho_Chi_Minh")
        now = datetime.now(UTC)

        jobs = await self.job_repo.get_all(active_only=True)
        for job in jobs:
            if not job.expected_cron:
                continue
            try:
                await self._check_job(job, now, tz_str)
            except Exception:
                logger.exception("overdue_scan: error checking job_id=%s", job.id)

    async def _check_job(self, job: Job, now: datetime, tz_str: str) -> None:
        last_real = await self.alert_repo.get_last_non_missed(job.id)
        last_missed = await self.alert_repo.get_last_missed(job.id)

        # Base: lần report thực tế gần nhất, hoặc created_at nếu chưa từng report
        base = last_real.completion_time if last_real else job.created_at
        if base.tzinfo is None:
            base = base.replace(tzinfo=UTC)

        base_local = base.astimezone(ZoneInfo(tz_str))
        try:
            next_expected = croniter(job.expected_cron, base_local).get_next(datetime)
        except Exception:
            logger.warning("overdue_scan: invalid cron '%s' job_id=%s", job.expected_cron, job.id)
            return

        if next_expected.tzinfo is None:
            next_expected = next_expected.replace(tzinfo=ZoneInfo(tz_str))

        deadline = next_expected + timedelta(minutes=job.grace_period)

        # Guard 1: chưa đến hạn
        if now < deadline:
            return

        # Guard 2: đã tạo missed alert cho downtime này rồi
        if last_missed:
            lm_time = last_missed.completion_time
            if lm_time.tzinfo is None:
                lm_time = lm_time.replace(tzinfo=UTC)
            if lm_time > base:
                return

        # Tạo missed alert
        alert = await self.alert_repo.create({
            "job_id": job.id,
            "job_name": job.name,
            "status": "missed",
            "completion_time": now,
            "duration_sec": None,
            "description": (
                f"Không nhận được report trước {deadline.astimezone(ZoneInfo(tz_str)).strftime('%H:%M')} "
                f"(cron: {job.expected_cron}, grace: {job.grace_period}m)"
            ),
            "log_content": None,
            "tags": job.tags or {},
        })

        logger.info(
            "overdue_scan: missed alert created job=%s alert_id=%s",
            job.name, alert.id,
        )

        # Gửi notification nếu opt-in (fire-and-forget)
        if "missed" in (job.immediate_on or []) and job.immediate_contacts:
            from app.services.notifications import dispatch_immediate
            alert_snapshot = {
                "job_name": alert.job_name,
                "status": alert.status,
                "completion_time": alert.completion_time,
                "duration_sec": None,
                "description": alert.description,
                "log_content": None,
            }
            asyncio.create_task(dispatch_immediate(job, alert_snapshot))
