import secrets
import uuid
import pytest
from datetime import datetime, timedelta, timezone
from app.repositories.alerts import AlertRepository
from app.db.models.alerts import Alert
from app.db.models.jobs import Job

UTC = timezone.utc


async def _create_job(db, name=None) -> Job:
    job = Job(name=name or f"job-{secrets.token_hex(4)}", token=secrets.token_hex(32))
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def _create_alert(db, job: Job, status: str, minutes_ago: int = 0) -> Alert:
    at = datetime.now(UTC) - timedelta(minutes=minutes_ago)
    alert = Alert(
        job_id=job.id,
        job_name=job.name,
        status=status,
        completion_time=at,
        received_at=at,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


@pytest.mark.asyncio
async def test_get_last_non_missed_returns_latest_real_alert(db_session):
    job = await _create_job(db_session)
    await _create_alert(db_session, job, "success", minutes_ago=10)
    latest = await _create_alert(db_session, job, "failure", minutes_ago=5)
    await _create_alert(db_session, job, "missed", minutes_ago=1)

    repo = AlertRepository(db_session)
    result = await repo.get_last_non_missed(job.id)

    assert result is not None
    assert result.id == latest.id
    assert result.status == "failure"


@pytest.mark.asyncio
async def test_get_last_non_missed_returns_none_when_only_missed(db_session):
    job = await _create_job(db_session)
    await _create_alert(db_session, job, "missed", minutes_ago=5)

    repo = AlertRepository(db_session)
    result = await repo.get_last_non_missed(job.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_last_non_missed_returns_none_when_no_alerts(db_session):
    job = await _create_job(db_session)

    repo = AlertRepository(db_session)
    result = await repo.get_last_non_missed(job.id)

    assert result is None


@pytest.mark.asyncio
async def test_get_last_missed_returns_latest_missed(db_session):
    job = await _create_job(db_session)
    await _create_alert(db_session, job, "missed", minutes_ago=10)
    latest_missed = await _create_alert(db_session, job, "missed", minutes_ago=5)
    await _create_alert(db_session, job, "success", minutes_ago=1)

    repo = AlertRepository(db_session)
    result = await repo.get_last_missed(job.id)

    assert result is not None
    assert result.id == latest_missed.id


@pytest.mark.asyncio
async def test_get_last_missed_returns_none_when_no_missed(db_session):
    job = await _create_job(db_session)
    await _create_alert(db_session, job, "success", minutes_ago=5)

    repo = AlertRepository(db_session)
    result = await repo.get_last_missed(job.id)

    assert result is None


# --- OverdueDetectionService tests ---

import asyncio
from unittest.mock import AsyncMock, patch
from app.services.overdue import OverdueDetectionService
from app.db.models.jobs import Job


async def _create_job_with_cron(
    db,
    cron: str = "0 2 * * *",
    grace: int = 30,
    immediate_on: list | None = None,
    immediate_contacts: list | None = None,
    name: str | None = None,
) -> Job:
    job = Job(
        name=name or f"job-{secrets.token_hex(4)}",
        token=secrets.token_hex(32),
        expected_cron=cron,
        grace_period=grace,
        immediate_on=immediate_on or ["failure", "missed"],
        immediate_contacts=immediate_contacts or [],
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@pytest.mark.asyncio
async def test_overdue_creates_missed_alert_when_past_deadline(db_session):
    """Job báo cáo lần cuối 2 giờ trước, cron mỗi phút, grace 30 phút → phải tạo missed."""
    job = await _create_job_with_cron(db_session, cron="* * * * *", grace=30)
    await _create_alert(db_session, job, "success", minutes_ago=90)

    with patch("app.services.overdue.asyncio.create_task"):
        with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
            service = OverdueDetectionService(db_session)
            await service.scan_all()

    from app.repositories.alerts import AlertRepository
    missed = await AlertRepository(db_session).get_last_missed(job.id)
    assert missed is not None
    assert missed.status == "missed"


@pytest.mark.asyncio
async def test_overdue_skips_when_not_yet_deadline(db_session):
    """Job report 1 phút trước, cron mỗi phút, grace 30 phút → chưa đến deadline."""
    job = await _create_job_with_cron(db_session, cron="* * * * *", grace=30)
    await _create_alert(db_session, job, "success", minutes_ago=1)

    with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
        service = OverdueDetectionService(db_session)
        await service.scan_all()

    from app.repositories.alerts import AlertRepository
    missed = await AlertRepository(db_session).get_last_missed(job.id)
    assert missed is None


@pytest.mark.asyncio
async def test_overdue_dedup_does_not_create_second_missed(db_session):
    """Đã có missed alert trong downtime này → không tạo thêm."""
    job = await _create_job_with_cron(db_session, cron="* * * * *", grace=30)
    # last_non_missed: 2 giờ trước
    await _create_alert(db_session, job, "success", minutes_ago=120)
    # missed đã được tạo 30 phút trước (sau deadline)
    await _create_alert(db_session, job, "missed", minutes_ago=30)

    with patch("app.services.overdue.asyncio.create_task") as mock_task:
        with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
            service = OverdueDetectionService(db_session)
            await service.scan_all()

    mock_task.assert_not_called()


@pytest.mark.asyncio
async def test_overdue_skips_job_without_expected_cron(db_session):
    """Job không có expected_cron → không bao giờ detect overdue."""
    job = Job(name=f"job-{secrets.token_hex(4)}", token=secrets.token_hex(32))
    db_session.add(job)
    await db_session.commit()

    with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
        service = OverdueDetectionService(db_session)
        await service.scan_all()

    from app.repositories.alerts import AlertRepository
    missed = await AlertRepository(db_session).get_last_missed(job.id)
    assert missed is None


@pytest.mark.asyncio
async def test_overdue_fires_notification_when_opted_in(db_session):
    """Job có 'missed' trong immediate_on và có contacts → gọi dispatch_immediate."""
    from unittest.mock import MagicMock
    contact_id = uuid.uuid4()
    job = await _create_job_with_cron(
        db_session,
        cron="* * * * *",
        grace=30,
        immediate_on=["failure", "missed"],
        immediate_contacts=[contact_id],
    )
    await _create_alert(db_session, job, "success", minutes_ago=90)

    mock_notifications = MagicMock()
    mock_notifications.dispatch_immediate = AsyncMock()
    with patch.dict("sys.modules", {"app.services.notifications": mock_notifications}):
        with patch("app.services.overdue.asyncio.create_task") as mock_task:
            with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
                service = OverdueDetectionService(db_session)
                await service.scan_all()

    mock_task.assert_called_once()


@pytest.mark.asyncio
async def test_overdue_no_notification_when_not_opted_in(db_session):
    """Job KHÔNG có 'missed' trong immediate_on → không gọi dispatch_immediate."""
    contact_id = uuid.uuid4()
    job = await _create_job_with_cron(
        db_session,
        cron="* * * * *",
        grace=30,
        immediate_on=["failure"],  # không có missed
        immediate_contacts=[contact_id],
    )
    await _create_alert(db_session, job, "success", minutes_ago=90)

    with patch("app.services.overdue.asyncio.create_task") as mock_task:
        with patch("app.repositories.settings.SettingsRepository.get_all", new_callable=AsyncMock, return_value={"display_timezone": "UTC"}):
            service = OverdueDetectionService(db_session)
            await service.scan_all()

    mock_task.assert_not_called()
