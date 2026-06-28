import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class ScheduleCreate(BaseModel):
    name: str
    cron_expr: str
    contacts: list[uuid.UUID] = []
    active: bool = True

    @field_validator("cron_expr")
    @classmethod
    def validate_cron(cls, v: str) -> str:
        parts = v.strip().split()
        if len(parts) != 5:
            raise ValueError("cron_expr must have 5 fields: minute hour day month dow")
        return v.strip()


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    cron_expr: Optional[str] = None
    contacts: Optional[list[uuid.UUID]] = None
    active: Optional[bool] = None

    @field_validator("cron_expr")
    @classmethod
    def validate_cron(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        parts = v.strip().split()
        if len(parts) != 5:
            raise ValueError("cron_expr must have 5 fields: minute hour day month dow")
        return v.strip()


class ScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    cron_expr: str
    contacts: list[uuid.UUID]
    active: bool
    created_at: datetime
    last_fired_at: Optional[datetime] = None
    last_status: Optional[str] = None
