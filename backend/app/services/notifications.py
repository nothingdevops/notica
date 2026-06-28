"""
Immediate notification dispatcher.
Called fire-and-forget after alert ingestion via asyncio.create_task().
"""

import asyncio
import logging

from app.db.models.jobs import Job
from app.db.session import async_session
from app.notifications.teams import send_teams_notification
from app.repositories.contacts import ContactRepository

logger = logging.getLogger(__name__)

RATE_LIMIT_DELAY = 0.25  # 250ms between webhook calls to avoid 429


async def dispatch_immediate(job: Job, alert: dict) -> None:
    """
    Fire immediate notifications for an alert.
    Runs in a background task — must open its own DB session.
    alert is a plain dict snapshot (not ORM object) to avoid DetachedInstanceError.
    """
    if not job.immediate_on or alert["status"] not in job.immediate_on:
        return
    if not job.immediate_contacts:
        return

    async with async_session() as db:
        from app.core.timezone import get_tz_name_from_db
        repo = ContactRepository(db)
        raw = await repo.get_by_ids(list(job.immediate_contacts))
        # Snapshot while session is open — avoids DetachedInstanceError after close
        contacts = [
            {"name": c.name, "type": c.type, "config": dict(c.config)}
            for c in raw
        ]
        tz_name = await get_tz_name_from_db(db)

    if not contacts:
        logger.warning("No active contacts found for job=%s", job.name)
        return

    for i, contact in enumerate(contacts):
        if i > 0:
            await asyncio.sleep(RATE_LIMIT_DELAY)

        if contact["type"] != "teams":
            logger.warning("Unknown contact type=%s — skipping", contact["type"])
            continue

        webhook_url = contact["config"].get("webhook_url")
        if not webhook_url:
            logger.warning("Contact %s missing webhook_url — skipping", contact["name"])
            continue

        success = await send_teams_notification(
            webhook_url=webhook_url,
            job_name=alert["job_name"],
            status=alert["status"],
            completion_time=alert["completion_time"],
            duration_sec=alert["duration_sec"],
            description=alert["description"],
            log_content=alert["log_content"],
            tz_name=tz_name,
        )
        logger.warning(
            "Notification contact=%s job=%s status=%s sent=%s",
            contact["name"], job.name, alert["status"], success,
        )
