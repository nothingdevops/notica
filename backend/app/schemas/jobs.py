import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, field_validator


def _validate_cron(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    parts = v.strip().split()
    if len(parts) != 5:
        raise ValueError("expected_cron must have 5 fields: minute hour day month dow")
    return v


class JobCreate(BaseModel):
    name: str
    description: Optional[str] = None
    expected_cron: Optional[str] = None
    grace_period: int = 30
    tags: dict = {}
    immediate_on: List[str] = ["failure", "missed"]
    immediate_contacts: List[uuid.UUID] = []

    @field_validator("expected_cron")
    @classmethod
    def validate_cron(cls, v: Optional[str]) -> Optional[str]:
        return _validate_cron(v)

    @field_validator("immediate_on")
    @classmethod
    def validate_statuses(cls, v: List[str]) -> List[str]:
        valid = {"success", "failure", "warning", "skipped", "missed"}
        for s in v:
            if s not in valid:
                raise ValueError(f"Invalid status '{s}'. Must be one of {valid}")
        return v


class JobUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    expected_cron: Optional[str] = None
    grace_period: Optional[int] = None
    tags: Optional[dict] = None
    immediate_on: Optional[List[str]] = None
    immediate_contacts: Optional[List[uuid.UUID]] = None
    active: Optional[bool] = None

    @field_validator("expected_cron")
    @classmethod
    def validate_cron(cls, v: Optional[str]) -> Optional[str]:
        return _validate_cron(v)

    @field_validator("immediate_on")
    @classmethod
    def validate_statuses(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        valid = {"success", "failure", "warning", "skipped", "missed"}
        for s in v:
            if s not in valid:
                raise ValueError(f"Invalid status '{s}'. Must be one of {valid}")
        return v


class JobListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str]
    token: str
    expected_cron: Optional[str]
    grace_period: int
    tags: dict
    immediate_on: List[str]
    immediate_contacts: List[uuid.UUID]
    active: bool
    created_at: datetime
    updated_at: datetime
    # Computed fields (không phải DB column, set bởi service)
    last_status: Optional[str] = None
    last_run_at: Optional[datetime] = None
    is_overdue: bool = False
    recent_statuses: List[str] = []


class JobResponse(JobListItem):
    pass


class TokenResponse(BaseModel):
    token: str
