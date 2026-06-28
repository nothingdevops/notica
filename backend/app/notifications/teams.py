"""
Teams Workflows Webhook adapter.
Sends Adaptive Cards v1.2 via the new Workflows webhook (not the retired Office 365 Connector).
"""

import logging
from datetime import datetime, timezone

import httpx

from app.core.timezone import fmt_time

logger = logging.getLogger(__name__)

STATUS_EMOJI = {
    "success": "✅",
    "failure": "🔴",
    "warning": "⚠️",
    "skipped": "⏭️",
}

STATUS_COLOR = {
    "success": "good",
    "failure": "attention",
    "warning": "warning",
    "skipped": "default",
}


def _format_duration(sec: int | None) -> str:
    if sec is None:
        return "—"
    if sec < 60:
        return f"{sec}s"
    m, s = divmod(sec, 60)
    return f"{m}m {s}s" if s else f"{m}m"


def _format_time(dt: datetime, tz_name: str | None = None) -> str:
    return fmt_time(dt, "%Y-%m-%d %H:%M:%S %Z", tz_name)


def _truncate(text: str | None, max_len: int = 300) -> str:
    if not text:
        return "—"
    return text[:max_len] + "…" if len(text) > max_len else text


def build_adaptive_card(
    job_name: str,
    status: str,
    completion_time: datetime,
    duration_sec: int | None,
    description: str | None,
    log_content: str | None,
    tz_name: str | None = None,
) -> dict:
    emoji = STATUS_EMOJI.get(status, "📋")
    color = STATUS_COLOR.get(status, "default")

    facts = [
        {"title": "Job",    "value": job_name},
        {"title": "Status", "value": status.upper()},
        {"title": "Time",   "value": _format_time(completion_time, tz_name)},
        {"title": "Duration", "value": _format_duration(duration_sec)},
    ]
    if description:
        facts.append({"title": "Message", "value": _truncate(description, 200)})

    # Error snippet from log — first non-empty line that looks like an error
    if log_content and status in ("failure", "warning"):
        snippet = _truncate(log_content, 300)
        facts.append({"title": "Log snippet", "value": snippet})

    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": [
            {
                "type": "TextBlock",
                "text": f"{emoji} Backup Alert — {job_name}",
                "weight": "Bolder",
                "size": "Medium",
                "color": color,
                "wrap": True,
            },
            {
                "type": "FactSet",
                "facts": facts,
            },
        ],
    }
    return card


def build_webhook_payload(card: dict) -> dict:
    """Wrap card in Teams Workflows webhook envelope."""
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": card,
            }
        ],
    }


async def send_teams_notification(
    webhook_url: str,
    job_name: str,
    status: str,
    completion_time: datetime,
    duration_sec: int | None = None,
    description: str | None = None,
    log_content: str | None = None,
    tz_name: str | None = None,
) -> bool:
    """Send one Adaptive Card to a Teams Workflows webhook. Returns True on success."""
    card = build_adaptive_card(
        job_name=job_name,
        status=status,
        completion_time=completion_time,
        duration_sec=duration_sec,
        description=description,
        log_content=log_content,
        tz_name=tz_name,
    )
    payload = build_webhook_payload(card)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code not in (200, 202):
                logger.warning(
                    "Teams webhook returned %s for job=%s: %s",
                    resp.status_code, job_name, resp.text[:200],
                )
                return False
            return True
    except httpx.TimeoutException:
        logger.error("Teams webhook timeout for job=%s url=%s", job_name, webhook_url[:60])
        return False
    except Exception as exc:
        logger.error("Teams webhook error for job=%s: %s", job_name, exc)
        return False
