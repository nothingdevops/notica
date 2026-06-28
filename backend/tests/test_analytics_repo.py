import uuid
import pytest
from datetime import datetime, timedelta, timezone
from app.repositories.analytics import AnalyticsRepository
from app.db.models.alerts import Alert
from app.db.models.jobs import Job


async def _create_job(db, name="test-job") -> Job:
    import secrets
    job = Job(name=name, token=secrets.token_hex(32))
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def _create_alert(db, job, status="success", days_ago=0, duration=60):
    at = datetime.now(timezone.utc) - timedelta(days=days_ago)
    alert = Alert(
        job_id=job.id,
        job_name=job.name,
        status=status,
        completion_time=at,
        received_at=at,
        duration_sec=duration,
    )
    db.add(alert)
    await db.commit()
    return alert


@pytest.mark.asyncio
async def test_get_job_stats_success_rate(db_session):
    job = await _create_job(db_session)
    await _create_alert(db_session, job, status="success")
    await _create_alert(db_session, job, status="failure")

    repo = AnalyticsRepository(db_session)
    result = await repo.get_job_stats(job.id, period_days=7)

    assert result.total_runs == 2
    assert result.success_rate == 50.0
    assert result.period_days == 7


@pytest.mark.asyncio
async def test_get_job_stats_daily_buckets(db_session):
    job = await _create_job(db_session, name="bucket-job")
    await _create_alert(db_session, job, status="success", days_ago=0)
    await _create_alert(db_session, job, status="failure", days_ago=1)

    repo = AnalyticsRepository(db_session)
    result = await repo.get_job_stats(job.id, period_days=7)

    assert len(result.daily_status) >= 2
    # Mỗi point có trường day là date string
    for pt in result.daily_status:
        assert len(pt.day) == 10  # "YYYY-MM-DD"


@pytest.mark.asyncio
async def test_get_overview_counts(db_session):
    job = await _create_job(db_session, name="ov-job")
    await _create_alert(db_session, job, status="success")
    await _create_alert(db_session, job, status="failure")

    repo = AnalyticsRepository(db_session)
    result = await repo.get_overview()

    assert result.total_jobs >= 1
    assert result.total_alerts_7d >= 2
    assert 0.0 <= result.success_rate_7d <= 100.0


@pytest.mark.asyncio
async def test_get_overview_top_failing(db_session):
    job = await _create_job(db_session, name="failing-job")
    for _ in range(3):
        await _create_alert(db_session, job, status="failure")

    repo = AnalyticsRepository(db_session)
    result = await repo.get_overview()

    names = [j.job_name for j in result.top_failing_jobs]
    assert "failing-job" in names
