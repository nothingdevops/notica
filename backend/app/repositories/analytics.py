from __future__ import annotations
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.alerts import Alert
from app.db.models.jobs import Job
from app.schemas.analytics import (
    DailyDurationPoint,
    DailyStatusPoint,
    EnvHealthItem,
    EnvHealthSparkPoint,
    HealthyJobSummary,
    JobStatsResponse,
    OverviewResponse,
    ProblemJobItem,
    TopFailingJob,
)

UTC = timezone.utc
STATUSES = ("success", "failure", "warning", "skipped")
_DAY = text("'day'")  # literal for date_trunc; avoids parameterized GROUP BY mismatch


def _cutoff(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def _iso_day(dt: datetime) -> str:
    """Convert datetime to YYYY-MM-DD string (UTC)."""
    return dt.astimezone(UTC).strftime("%Y-%m-%d")


def _trunc_day(col):
    return func.date_trunc(_DAY, col)


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_job_stats(self, job_id: uuid.UUID, period_days: int) -> JobStatsResponse:
        since = _cutoff(period_days)

        # --- Daily status counts ---
        rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.job_id == job_id, Alert.received_at >= since)
            .group_by(_trunc_day(Alert.received_at), Alert.status)
            .order_by(_trunc_day(Alert.received_at))
        )
        bucket: dict[str, dict[str, int]] = defaultdict(lambda: {s: 0 for s in STATUSES})
        total = 0
        success_count = 0
        for row in rows:
            day_str = _iso_day(row.day)
            bucket[day_str][row.status] = row.cnt
            total += row.cnt
            if row.status == "success":
                success_count += row.cnt

        daily_status = [
            DailyStatusPoint(day=d, **counts) for d, counts in sorted(bucket.items())
        ]
        success_rate = round(success_count * 100.0 / total, 1) if total else 0.0

        # --- Daily avg duration ---
        dur_rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                func.avg(Alert.duration_sec).label("avg_dur"),
            )
            .where(
                Alert.job_id == job_id,
                Alert.received_at >= since,
                Alert.duration_sec.is_not(None),
            )
            .group_by(_trunc_day(Alert.received_at))
            .order_by(_trunc_day(Alert.received_at))
        )
        daily_duration = [
            DailyDurationPoint(
                day=_iso_day(r.day),
                avg_duration=round(float(r.avg_dur), 1) if r.avg_dur is not None else None,
            )
            for r in dur_rows
        ]

        return JobStatsResponse(
            job_id=job_id,
            period_days=period_days,
            success_rate=success_rate,
            total_runs=total,
            daily_status=daily_status,
            daily_duration=daily_duration,
        )

    async def get_overview(self, period_days: int = 7) -> OverviewResponse:
        since = _cutoff(period_days)

        # --- Job counts ---
        job_counts = await self.db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Job.active == True).label("active"),  # noqa: E712
            ).select_from(Job)
        )
        jc = job_counts.one()

        # --- System-wide daily status (7d) ---
        rows = await self.db.execute(
            select(
                _trunc_day(Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.received_at >= since)
            .group_by(_trunc_day(Alert.received_at), Alert.status)
            .order_by(_trunc_day(Alert.received_at))
        )
        bucket: dict[str, dict[str, int]] = defaultdict(lambda: {s: 0 for s in STATUSES})
        total_7d = 0
        success_7d = 0
        for row in rows:
            day_str = _iso_day(row.day)
            bucket[day_str][row.status] = row.cnt
            total_7d += row.cnt
            if row.status == "success":
                success_7d += row.cnt

        daily_status = [
            DailyStatusPoint(day=d, **counts) for d, counts in sorted(bucket.items())
        ]
        success_rate_7d = round(success_7d * 100.0 / total_7d, 1) if total_7d else 0.0

        # --- Top 5 failing jobs (7d) ---
        top_rows = await self.db.execute(
            select(Alert.job_name, func.count().label("cnt"))
            .where(Alert.status == "failure", Alert.received_at >= since)
            .group_by(Alert.job_name)
            .order_by(func.count().desc())
            .limit(5)
        )
        top_failing = [
            TopFailingJob(job_name=r.job_name, failure_count=r.cnt) for r in top_rows
        ]

        # --- Failing job IDs (7d) ---
        failing_job_ids_q = (
            select(func.distinct(Alert.job_id))
            .where(Alert.received_at >= since, Alert.status == "failure")
        )
        failing_job_ids = [
            r[0] for r in (await self.db.execute(failing_job_ids_q)).all()
        ]
        failing_jobs_count = len(failing_job_ids)
        healthy_jobs_count = jc.total - failing_jobs_count

        # --- Healthy jobs list ---
        healthy_jobs_q = select(Job.id, Job.name, Job.tags).where(
            Job.active == True,  # noqa: E712
            Job.id.not_in(failing_job_ids) if failing_job_ids else True,
        )
        healthy_jobs_rows = (await self.db.execute(healthy_jobs_q)).all()
        healthy_jobs: list[HealthyJobSummary] = [
            HealthyJobSummary(
                job_id=r.id,
                job_name=r.name,
                env=(r.tags or {}).get("env", "other"),
            )
            for r in healthy_jobs_rows
        ]

        # --- Env health ---
        all_jobs_q = select(Job.id, Job.tags).where(Job.active == True)  # noqa: E712
        all_jobs_rows = (await self.db.execute(all_jobs_q)).all()

        job_env_map: dict[str, str] = {}
        for job_id, tags in all_jobs_rows:
            env = (tags or {}).get("env", "other")
            job_env_map[str(job_id)] = env

        # Per-job-per-day-per-status alert counts for env aggregation
        env_alerts_q = (
            select(
                Alert.job_id,
                _trunc_day(Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.received_at >= since)
            .group_by(Alert.job_id, _trunc_day(Alert.received_at), Alert.status)
        )
        env_alert_rows = (await self.db.execute(env_alerts_q)).all()

        env_data: dict[str, dict] = defaultdict(lambda: {
            "job_ids_with_failure": set(),
            "total_jobs": set(),
            "total_success": 0,
            "total_runs": 0,
            "daily_failures": defaultdict(int),
            "daily_runs": defaultdict(int),
        })

        for job_id, day, status, cnt in env_alert_rows:
            env = job_env_map.get(str(job_id), "other")
            day_str = _iso_day(day)
            env_data[env]["total_jobs"].add(str(job_id))
            env_data[env]["total_runs"] += cnt
            env_data[env]["daily_runs"][day_str] += cnt
            if status == "success":
                env_data[env]["total_success"] += cnt
            if status == "failure":
                env_data[env]["job_ids_with_failure"].add(str(job_id))
                env_data[env]["daily_failures"][day_str] += cnt

        # Ensure all active jobs are counted even if they have no alerts in period
        for job_id_str, env in job_env_map.items():
            env_data[env]["total_jobs"].add(job_id_str)

        env_health: list[EnvHealthItem] = []
        env_order = ["prod", "staging", "dev", "dr", "other"]
        for env in env_order:
            if env not in env_data:
                continue
            d = env_data[env]
            total_j = len(d["total_jobs"])
            if total_j == 0:
                continue
            fail_j = len(d["job_ids_with_failure"])
            sr = (d["total_success"] / d["total_runs"] * 100) if d["total_runs"] > 0 else 100.0

            daily_spark = []
            for i in range(period_days):
                day_dt = since + timedelta(days=i)
                day_str = day_dt.strftime("%Y-%m-%d")
                runs = d["daily_runs"].get(day_str, 0)
                fails = d["daily_failures"].get(day_str, 0)
                fr = (fails / runs) if runs > 0 else 0.0
                daily_spark.append(EnvHealthSparkPoint(day=day_str, failure_rate=fr))

            env_health.append(EnvHealthItem(
                env=env,
                total_jobs=total_j,
                failing_jobs=fail_j,
                success_rate=round(sr, 1),
                daily_spark=daily_spark,
            ))

        # --- Problem jobs ---
        problem_jobs: list[ProblemJobItem] = []
        for jid in failing_job_ids:
            job_q = select(Job.name, Job.tags).where(Job.id == jid)
            job_row = (await self.db.execute(job_q)).first()
            if not job_row:
                continue
            job_name, job_tags = job_row
            env = (job_tags or {}).get("env", "other")

            daily_q = (
                select(
                    _trunc_day(Alert.received_at).label("day"),
                    Alert.status,
                    func.count().label("cnt"),
                )
                .where(Alert.job_id == jid, Alert.received_at >= since)
                .group_by(_trunc_day(Alert.received_at), Alert.status)
                .order_by(_trunc_day(Alert.received_at))
            )
            daily_rows = (await self.db.execute(daily_q)).all()

            day_buckets: dict[str, dict[str, int]] = {}
            total_runs = 0
            total_success = 0
            failure_count = 0

            for day, status, cnt in daily_rows:
                day_str = _iso_day(day)
                if day_str not in day_buckets:
                    day_buckets[day_str] = {
                        "success": 0,
                        "failure": 0,
                        "warning": 0,
                        "skipped": 0,
                    }
                day_buckets[day_str][status] = cnt
                total_runs += cnt
                if status == "success":
                    total_success += cnt
                if status == "failure":
                    failure_count += cnt

            last_q = (
                select(func.max(Alert.received_at))
                .where(Alert.job_id == jid, Alert.received_at >= since)
            )
            last_alert_at = (await self.db.execute(last_q)).scalar()

            daily_status_list: list[DailyStatusPoint] = []
            for i in range(period_days):
                day_dt = since + timedelta(days=i)
                day_str = day_dt.strftime("%Y-%m-%d")
                b = day_buckets.get(day_str, {})
                daily_status_list.append(DailyStatusPoint(
                    day=day_str,
                    success=b.get("success", 0),
                    failure=b.get("failure", 0),
                    warning=b.get("warning", 0),
                    skipped=b.get("skipped", 0),
                ))

            sr = (total_success / total_runs * 100) if total_runs > 0 else 0.0
            problem_jobs.append(ProblemJobItem(
                job_id=jid,
                job_name=job_name,
                env=env,
                success_rate=round(sr, 1),
                failure_count=failure_count,
                total_runs=total_runs,
                daily_status=daily_status_list,
                last_alert_at=last_alert_at,
            ))

        problem_jobs.sort(key=lambda x: x.failure_count, reverse=True)

        # --- System-wide daily avg duration (7d) ---
        sys_dur_q = (
            select(
                _trunc_day(Alert.received_at).label("day"),
                func.avg(Alert.duration_sec).label("avg_dur"),
            )
            .where(
                Alert.received_at >= since,
                Alert.duration_sec.is_not(None),
            )
            .group_by(_trunc_day(Alert.received_at))
            .order_by(_trunc_day(Alert.received_at))
        )
        sys_dur_rows = (await self.db.execute(sys_dur_q)).all()
        dur_map = {_iso_day(r.day): float(r.avg_dur) for r in sys_dur_rows}
        daily_duration: list[DailyDurationPoint] = []
        for i in range(period_days):
            day_dt = since + timedelta(days=i)
            day_str = day_dt.strftime("%Y-%m-%d")
            daily_duration.append(
                DailyDurationPoint(day=day_str, avg_duration=dur_map.get(day_str))
            )

        return OverviewResponse(
            total_jobs=jc.total,
            active_jobs=jc.active,
            success_rate=success_rate_7d,
            total_alerts=total_7d,
            daily_status=daily_status,
            top_failing_jobs=top_failing,
            failing_jobs_count=failing_jobs_count,
            healthy_jobs_count=healthy_jobs_count,
            env_health=env_health,
            problem_jobs=problem_jobs,
            healthy_jobs=healthy_jobs,
            daily_duration=daily_duration,
        )
