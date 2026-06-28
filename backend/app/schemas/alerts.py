import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class AlertIngest(BaseModel):
    status: str
    completion_time: datetime
    description: Optional[str] = None
    log_content: Optional[str] = None
    duration_sec: Optional[int] = None
    tags: dict = {}

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid = {"success", "failure", "warning", "skipped"}
        if v not in valid:
            raise ValueError(f"status must be one of {valid}")
        return v


class AlertListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_id: uuid.UUID
    job_name: str
    status: str
    completion_time: datetime
    duration_sec: Optional[int]
    description: Optional[str]
    tags: dict
    received_at: datetime
    # log_content không có ở đây — chỉ có trong AlertResponse


class AlertResponse(AlertListItem):
    log_content: Optional[str] = None
