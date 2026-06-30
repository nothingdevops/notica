import logging
import uuid

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.db.models.schedules import Schedule
from app.db.session import async_session
from app.repositories.schedules import ScheduleRepository

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None
_scheduler_tz: str = "UTC"


def get_scheduler() -> AsyncIOScheduler:
    assert _scheduler is not None, "Scheduler not started"
    return _scheduler


async def start_scheduler() -> AsyncIOScheduler:
    global _scheduler, _scheduler_tz

    async with async_session() as db:
        from app.repositories.settings import SettingsRepository
        stored = await SettingsRepository(db).get_all()
        _scheduler_tz = str(stored.get("display_timezone") or "Asia/Ho_Chi_Minh")

        schedules = await ScheduleRepository(db).get_all(active_only=True)

    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.start()
    logger.info("APScheduler started (cron timezone: %s)", _scheduler_tz)

    for s in schedules:
        _register_job(s)
    logger.info("Loaded %d active schedules", len(schedules))

    from app.scheduler.jobs import retention_purge_job
    _scheduler.add_job(
        retention_purge_job,
        CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="retention_purge",
        replace_existing=True,
    )
    logger.info("Registered retention purge job (daily 02:00 UTC)")

    from app.scheduler.jobs import overdue_scan_job
    _overdue_interval = int(stored.get("overdue_scan_interval") or 1)
    _scheduler.add_job(
        overdue_scan_job,
        IntervalTrigger(minutes=_overdue_interval),
        id="overdue_scan",
        replace_existing=True,
    )
    logger.info("Registered overdue scan job (every %d minute(s))", _overdue_interval)

    return _scheduler


def _parse_cron(cron_expr: str) -> dict:
    parts = cron_expr.strip().split()
    return {
        "minute":      parts[0],
        "hour":        parts[1],
        "day":         parts[2],
        "month":       parts[3],
        "day_of_week": parts[4],
    }


def _register_job(schedule: Schedule) -> None:
    from app.scheduler.jobs import digest_job

    cron_kwargs = _parse_cron(schedule.cron_expr)
    _scheduler.add_job(
        digest_job,
        CronTrigger(**cron_kwargs, timezone=_scheduler_tz),
        id=str(schedule.id),
        args=[schedule.id],
        replace_existing=True,
    )
    logger.info(
        "Scheduled digest job id=%s name=%s cron=%s tz=%s",
        schedule.id, schedule.name, schedule.cron_expr, _scheduler_tz,
    )


def add_schedule_job(schedule: Schedule) -> None:
    if schedule.active:
        _register_job(schedule)


def remove_schedule_job(schedule_id: uuid.UUID) -> None:
    try:
        _scheduler.remove_job(str(schedule_id))
        logger.info("Removed scheduler job id=%s", schedule_id)
    except JobLookupError:
        pass


def sync_schedule_job(schedule: Schedule) -> None:
    """Update scheduler when schedule is modified."""
    remove_schedule_job(schedule.id)
    if schedule.active:
        _register_job(schedule)


def sync_overdue_scan_job(interval_minutes: int) -> None:
    from app.scheduler.jobs import overdue_scan_job as _job
    _scheduler.add_job(
        _job,
        IntervalTrigger(minutes=interval_minutes),
        id="overdue_scan",
        replace_existing=True,
    )
    logger.info("overdue_scan re-registered: interval=%dm", interval_minutes)
