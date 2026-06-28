from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.config import settings

_DEFAULT_TZ = "Asia/Ho_Chi_Minh"


def _get_tz(tz_name: str | None = None) -> ZoneInfo | timezone:
    name = tz_name or getattr(settings, "display_timezone", None) or _DEFAULT_TZ
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, KeyError):
        return timezone.utc


def fmt_time(dt: datetime, fmt: str = "%Y-%m-%d %H:%M %Z", tz_name: str | None = None) -> str:
    """Format datetime in the configured display timezone."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    tz = _get_tz(tz_name)
    return dt.astimezone(tz).strftime(fmt)


def tz_label(tz_name: str | None = None) -> str:
    """Short label like 'UTC+07' or 'UTC' for card footers."""
    name = tz_name or getattr(settings, "display_timezone", None) or _DEFAULT_TZ
    try:
        tz = ZoneInfo(name)
        now = datetime.now(tz)
        offset = now.strftime("%z")   # e.g. "+0700", "-0500"
        if not offset or offset == "+0000":
            return "UTC"
        sign  = offset[0]
        hours = int(offset[1:3])
        return f"UTC{sign}{hours:02d}"
    except Exception:
        return "UTC"


async def get_tz_name_from_db(db) -> str:
    """Read display_timezone from settings DB, fallback to Asia/Ho_Chi_Minh."""
    from app.repositories.settings import SettingsRepository
    value = await SettingsRepository(db).get("display_timezone")
    return str(value) if value else _DEFAULT_TZ
