from typing import Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, field_validator


class SettingsUpdate(BaseModel):
    retention_days: Optional[int] = None
    app_url: Optional[str] = None
    display_timezone: Optional[str] = None
    organization_name: Optional[str] = None

    @field_validator("retention_days")
    @classmethod
    def validate_retention(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if not (1 <= v <= 3650):
            raise ValueError("retention_days must be between 1 and 3650")
        return v

    @field_validator("app_url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("app_url must be a valid http or https URL")
        return v

    @field_validator("display_timezone")
    @classmethod
    def validate_timezone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, KeyError):
            raise ValueError(f"Invalid IANA timezone: {v}")
        return v


class SettingsResponse(BaseModel):
    retention_days: int
    app_url: str
    display_timezone: str
    organization_name: str
    has_logo: bool = False
    has_favicon: bool = False
