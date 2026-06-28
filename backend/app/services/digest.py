"""
Digest service: build Adaptive Card report + send to contacts.
"""
import json
import logging
from datetime import datetime

from app.core.config import settings
from app.core.timezone import fmt_time, get_tz_name_from_db, tz_label
from app.db.models.alerts import Alert
from app.db.models.schedules import Schedule
from app.db.session import async_session
from app.notifications.teams import build_webhook_payload, send_teams_notification
from app.repositories.contacts import ContactRepository

logger = logging.getLogger(__name__)


async def _get_app_url(db) -> str:
    from app.repositories.settings import SettingsRepository
    value = await SettingsRepository(db).get("app_url")
    return str(value) if value is not None else settings.app_url

STATUS_EMOJI = {
    "success": "✓",
    "failure": "❌",
    "warning": "⚠️",
    "skipped": "⏭️",
}
STATUS_EMOJI_COLOR = {
    "success": "good",
}
STATUS_TEXT_COLOR = {
    "failure": "attention",
}
STATUS_ORDER   = {"failure": 0, "warning": 1, "success": 2, "skipped": 3}
STATUS_STYLE   = {"failure": "default", "warning": "default", "success": "default", "skipped": "default"}
MAX_PAYLOAD_BYTES = 27_000


def _fmt_duration(sec: int | None) -> str:
    if sec is None:
        return "—"
    m, s = divmod(sec, 60)
    return f"{m}m {s}s" if m else f"{s}s"


def _stat_column(emoji: str, label: str, count: int, color: str) -> dict:
    return {
        "type": "Column",
        "width": "stretch",
        "items": [
            {
                "type": "TextBlock",
                "text": str(count),
                "size": "ExtraLarge",
                "weight": "Bolder",
                "color": color,
                "horizontalAlignment": "Center",
                "wrap": False,
            },
            {
                "type": "TextBlock",
                "text": f"{emoji} {label}",
                "size": "Small",
                "isSubtle": True,
                "horizontalAlignment": "Center",
                "spacing": "None",
                "wrap": False,
            },
        ],
    }


def _stats_bar(counts: dict) -> dict:
    return {
        "type": "Container",
        "style": "emphasis",
        "bleed": True,
        "spacing": "Small",
        "items": [{
            "type": "ColumnSet",
            "columns": [
                _stat_column("❌", "Failed",  counts.get("failure", 0), "attention"),
                _stat_column("⚠️", "Warning", counts.get("warning", 0), "warning"),
                _stat_column("✅", "Success", counts.get("success", 0), "good"),
                _stat_column("⏭️", "Skipped", counts.get("skipped", 0), "default"),
            ],
        }],
    }


def _table_header() -> dict:
    """Column header row styled as an emphasis band."""
    def hcol(text: str, width: str) -> dict:
        return {
            "type": "Column",
            "width": width,
            "items": [{
                "type": "TextBlock",
                "text": text,
                "weight": "Bolder",
                "size": "Small",
                "color": "Accent",
                "wrap": False,
                "spacing": "None",
            }],
            "verticalContentAlignment": "Center",
        }

    return {
        "type": "Container",
        "style": "emphasis",
        "bleed": True,
        "spacing": "Medium",
        "items": [{
            "type": "ColumnSet",
            "spacing": "None",
            "columns": [
                hcol("",     "auto"),
                hcol("Job",  "stretch"),
                hcol("Time", "90px"),
                hcol("Log",  "55px"),
            ],
        }],
    }


def _table_row(alert: Alert, app_url: str, tz_name: str | None = None) -> dict:
    """One table row per alert."""
    emoji       = STATUS_EMOJI.get(alert.status, "📋")
    emoji_color = STATUS_EMOJI_COLOR.get(alert.status)
    text_color  = STATUS_TEXT_COLOR.get(alert.status)
    style       = STATUS_STYLE.get(alert.status, "default")
    view_url    = f"{app_url.rstrip('/')}/alerts/{alert.id}"
    time_str    = fmt_time(alert.completion_time, "%d/%m %H:%M", tz_name)

    def col(items: list, width: str) -> dict:
        return {
            "type": "Column",
            "width": width,
            "items": items,
            "verticalContentAlignment": "Center",
        }

    def tb(text: str, **kwargs) -> dict:
        return {"type": "TextBlock", "text": text, "size": "Small", "wrap": False, "spacing": "None", **kwargs}

    emoji_tb = tb(emoji, **({"color": emoji_color} if emoji_color else {}))

    job_items: list[dict] = [tb(alert.job_name, wrap=True, **({"color": text_color} if text_color else {}))]
    if alert.description:
        job_items.append(tb(alert.description, isSubtle=True, wrap=True, maxLines=2, **({"color": text_color} if text_color else {})))

    return {
        "type": "Container",
        "style": style,
        "spacing": "ExtraSmall",
        "items": [{
            "type": "ColumnSet",
            "spacing": "Small",
            "columns": [
                col([emoji_tb], "auto"),
                col(job_items, "stretch"),
                col([tb(time_str, isSubtle=True)], "90px"),
                col([{
                    "type": "ActionSet",
                    "spacing": "None",
                    "actions": [{"type": "Action.OpenUrl", "title": "Logs", "url": view_url}],
                }], "55px"),
            ],
        }],
    }


def _build_card(
    schedule_name: str,
    alerts: list[Alert],
    fired_at: datetime,
    next_fire_at: datetime | None,
    app_url: str,
    chunk_info: str = "",
    tz_name: str | None = None,
) -> dict:
    sorted_alerts = sorted(alerts, key=lambda a: STATUS_ORDER.get(a.status, 99))
    counts = {s: sum(1 for a in alerts if a.status == s) for s in STATUS_ORDER}
    tz = tz_label(tz_name)

    title = f"📊 Backup Digest · {schedule_name}"
    if chunk_info:
        title += f" {chunk_info}"
    subtitle = f"{fmt_time(fired_at, '%d %b %Y, %H:%M', tz_name)} {tz} · {len(alerts)} run{'s' if len(alerts) != 1 else ''}"

    header = {
        "type": "Container",
        "items": [
            {"type": "TextBlock", "text": title,    "weight": "Bolder", "size": "Medium", "wrap": True},
            {"type": "TextBlock", "text": subtitle, "isSubtle": True,   "size": "Small",  "spacing": "None", "wrap": True},
        ],
    }

    body: list[dict] = [header, _stats_bar(counts)]

    if sorted_alerts:
        body.append(_table_header())
        for alert in sorted_alerts:
            body.append(_table_row(alert, app_url, tz_name))

    footer_parts = [f"Notica · {tz}"]
    if next_fire_at:
        footer_parts.append(f"Next: {fmt_time(next_fire_at, '%d/%m %H:%M', tz_name)}")
    body.append({
        "type": "TextBlock",
        "text": " · ".join(footer_parts),
        "isSubtle": True,
        "size": "Small",
        "spacing": "Large",
        "wrap": True,
    })

    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": body,
    }


def _chunk_alerts(
    alerts: list[Alert],
    schedule_name: str,
    fired_at: datetime,
    next_fire_at: datetime | None,
    app_url: str,
    tz_name: str | None = None,
) -> list[dict]:
    """Split alerts into multiple cards if payload exceeds MAX_PAYLOAD_BYTES."""
    card = _build_card(schedule_name, alerts, fired_at, next_fire_at, app_url, tz_name=tz_name)
    payload = build_webhook_payload(card)
    if len(json.dumps(payload).encode()) <= MAX_PAYLOAD_BYTES:
        return [payload]

    chunk_size = max(1, len(alerts) // ((len(json.dumps(payload).encode()) // MAX_PAYLOAD_BYTES) + 1))
    chunks = [alerts[i:i + chunk_size] for i in range(0, len(alerts), chunk_size)]
    payloads = []
    for i, chunk in enumerate(chunks, 1):
        info = f"({i}/{len(chunks)})"
        c = _build_card(schedule_name, chunk, fired_at, next_fire_at if i == len(chunks) else None, app_url, info, tz_name)
        payloads.append(build_webhook_payload(c))
    return payloads


class DigestService:
    async def send_digest(
        self,
        schedule: Schedule,
        alerts: list[Alert],
        fired_at: datetime,
        next_fire_at: datetime | None,
    ) -> tuple[int, int]:
        """Send digest to all contacts. Returns (sent, failed) counts."""
        import asyncio

        async with async_session() as db:
            contacts = await ContactRepository(db).get_by_ids(list(schedule.contacts))
            app_url = await _get_app_url(db)
            tz_name = await get_tz_name_from_db(db)

        if not contacts:
            logger.warning("digest: no active contacts for schedule=%s", schedule.name)
            return 0, 0

        payloads = _chunk_alerts(
            alerts, schedule.name, fired_at, next_fire_at, app_url, tz_name
        )

        sent = failed = 0
        for i, contact in enumerate(contacts):
            if i > 0:
                await asyncio.sleep(0.25)
            if contact.type != "teams":
                continue
            webhook_url = contact.config.get("webhook_url", "")
            if not webhook_url:
                continue

            contact_ok = True
            for payload in payloads:
                import httpx
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post(webhook_url, json=payload)
                        if resp.status_code not in (200, 202):
                            contact_ok = False
                except Exception as exc:
                    logger.error("digest send error contact=%s: %s", contact.name, exc)
                    contact_ok = False
                if len(payloads) > 1:
                    await asyncio.sleep(0.25)

            if contact_ok:
                sent += 1
            else:
                failed += 1

        logger.info(
            "digest sent schedule=%s alerts=%d contacts sent=%d failed=%d",
            schedule.name, len(alerts), sent, failed,
        )
        return sent, failed
