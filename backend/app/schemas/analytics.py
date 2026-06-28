from __future__ import annotations
import uuid
from pydantic import BaseModel


class DailyStatusPoint(BaseModel):
    day: str        # "2026-06-28"
    success: int = 0
    failure: int = 0
    warning: int = 0
    skipped: int = 0


class DailyDurationPoint(BaseModel):
    day: str
    avg_duration: float | None  # seconds, None nếu không có data


class TopFailingJob(BaseModel):
    job_name: str
    failure_count: int


class JobStatsResponse(BaseModel):
    job_id: uuid.UUID
    period_days: int
    success_rate: float        # 0.0–100.0
    total_runs: int
    daily_status: list[DailyStatusPoint]
    daily_duration: list[DailyDurationPoint]


class OverviewResponse(BaseModel):
    total_jobs: int
    active_jobs: int
    success_rate_7d: float     # 0.0–100.0
    total_alerts_7d: int
    daily_status: list[DailyStatusPoint]   # 7 ngày, system-wide
    top_failing_jobs: list[TopFailingJob]  # top 5
