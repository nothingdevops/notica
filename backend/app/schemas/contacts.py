import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, HttpUrl, field_validator


class TeamsConfig(BaseModel):
    webhook_url: str

    @field_validator("webhook_url")
    @classmethod
    def validate_webhook(cls, v: str) -> str:
        if not v.startswith("https://"):
            raise ValueError("webhook_url must be an HTTPS URL")
        return v


class ContactCreate(BaseModel):
    name: str
    type: str = "teams"
    config: dict[str, Any]
    active: bool = True

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in {"teams"}:
            raise ValueError("type must be 'teams' (more adapters coming in future)")
        return v

    @field_validator("config")
    @classmethod
    def validate_config(cls, v: dict, info: Any) -> dict:
        contact_type = (info.data or {}).get("type", "teams")
        if contact_type == "teams":
            TeamsConfig(**v)  # raises ValueError if webhook_url missing/invalid
        return v


class ContactUpdate(BaseModel):
    name: str | None = None
    config: dict[str, Any] | None = None
    active: bool | None = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    type: str
    config: dict[str, Any]
    active: bool
    created_at: datetime
