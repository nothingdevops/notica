from __future__ import annotations
import uuid
from datetime import datetime
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


class EnvHealthSparkPoint(BaseModel):
    day: str          # "YYYY-MM-DD"
    failure_rate: float   # 0.0..1.0


class EnvHealthItem(BaseModel):
    env: str              # "prod" | "staging" | "dev" | "dr" | "other"
    total_jobs: int
    failing_jobs: int     # jobs with ≥1 failure in period
    success_rate: float   # 0.0..100.0
    daily_spark: list[EnvHealthSparkPoint]  # 7 points


class ProblemJobItem(BaseModel):
    job_id: uuid.UUID
    job_name: str
    env: str              # from tags["env"] or "other"
    success_rate: float
    failure_count: int
    total_runs: int
    daily_status: list[DailyStatusPoint]   # 7 days for mini heatmap
    last_alert_at: datetime | None


class JobStatsResponse(BaseModel):
    job_id: uuid.UUID
    period_days: int
    success_rate: float        # 0.0–100.0
    total_runs: int
    daily_status: list[DailyStatusPoint]
    daily_duration: list[DailyDurationPoint]


class HealthyJobSummary(BaseModel):
    job_id: uuid.UUID
    job_name: str
    env: str


class OverviewResponse(BaseModel):
    total_jobs: int
    active_jobs: int
    success_rate: float        # 0.0–100.0 (for requested period)
    total_alerts: int
    daily_status: list[DailyStatusPoint]
    top_failing_jobs: list[TopFailingJob]
    failing_jobs_count: int
    healthy_jobs_count: int
    env_health: list[EnvHealthItem]
    problem_jobs: list[ProblemJobItem]
    healthy_jobs: list[HealthyJobSummary]
    daily_duration: list[DailyDurationPoint]
