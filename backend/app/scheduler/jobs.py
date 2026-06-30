import logging
import uuid
from datetime import UTC, datetime, timedelta

from croniter import croniter

from app.db.session import async_session
from app.repositories.alerts import AlertRepository
from app.repositories.schedules import ScheduleRepository
from app.services.digest import DigestService

logger = logging.getLogger(__name__)


def _estimate_interval(cron_expr: str) -> timedelta:
    """Estimate cron interval by computing gap between two consecutive fires."""
    base = datetime.now(UTC)
    c = croniter(cron_expr, base)
    t1 = c.get_next(datetime)
    t2 = c.get_next(datetime)
    return t2 - t1


async def digest_job(schedule_id: uuid.UUID, force: bool = False) -> None:
    logger.info("digest_job fired schedule_id=%s force=%s", schedule_id, force)

    async with async_session() as db:
        repo = ScheduleRepository(db)
        schedule = await repo.get_by_id(schedule_id)

        if not schedule or not schedule.active:
            logger.info("digest_job: schedule %s inactive or missing — skip", schedule_id)
            return

        now = datetime.now(UTC)
        last_scheduled = await repo.get_last_success(schedule_id)

        # Idempotency: skip if a scheduled send already happened within this cron window.
        # Uses only "success" records so Run Now (stored as "forced") never blocks scheduled fires.
        interval = _estimate_interval(schedule.cron_expr)
        if not force and last_scheduled and (now - last_scheduled.fired_at) < interval * 0.9:
            logger.info(
                "digest_job: idempotency skip schedule=%s last_fired=%s",
                schedule.name, last_scheduled.fired_at,
            )
            return

        # Window always starts from last scheduled success — Run Now is a preview of the
        # same window and does not advance the scheduled cursor.
        window_start = last_scheduled.fired_at if last_scheduled else (now - timedelta(hours=24))
        logger.info(
            "digest_job: window [%s → %s] schedule=%s",
            window_start, now, schedule.name,
        )

        alerts = await AlertRepository(db).get_in_window(window_start, now)

    if not alerts:
        logger.info(
            "digest_job: no alerts in window [%s → %s] schedule=%s — skip",
            window_start, now, schedule.name,
        )
        return

    # Compute next fire time
    cron = croniter(schedule.cron_expr, now)
    next_fire = cron.get_next(datetime).replace(tzinfo=UTC)

    status = "failure"
    try:
        await DigestService().send_digest(schedule, alerts, now, next_fire, force=force)
        status = "forced" if force else "success"
    except Exception:
        logger.exception("digest_job: send failed schedule=%s", schedule.name)

    async with async_session() as db:
        await ScheduleRepository(db).record_execution(schedule_id, now, status)
        logger.info("digest_job: recorded execution status=%s schedule=%s", status, schedule.name)


async def retention_purge_job() -> None:
    import asyncio
    from datetime import timedelta
    from app.repositories.alerts import AlertRepository
    from app.repositories.settings import SettingsRepository

    async with async_session() as db:
        value = await SettingsRepository(db).get("retention_days")
    retention_days = int(value) if value is not None else 90
    cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=retention_days)

    total_deleted = 0
    while True:
        async with async_session() as db:
            deleted = await AlertRepository(db).delete_older_than_batch(cutoff)
        total_deleted += deleted
        if deleted < 500:
            break
        await asyncio.sleep(0.1)

    logger.info(
        "retention_purge: deleted %d alerts older than %d days",
        total_deleted,
        retention_days,
    )


async def overdue_scan_job() -> None:
    from app.services.overdue import OverdueDetectionService
    async with async_session() as db:
        await OverdueDetectionService(db).scan_all()
    logger.info("overdue_scan_job: scan complete")
