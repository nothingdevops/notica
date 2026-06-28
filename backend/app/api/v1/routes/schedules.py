import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.db.models.schedules import Schedule
from app.repositories.schedules import ScheduleRepository
from app.scheduler.setup import add_schedule_job, remove_schedule_job, sync_schedule_job
from app.schemas.schedules import ScheduleCreate, ScheduleResponse, ScheduleUpdate

router = APIRouter(prefix="/schedules", tags=["schedules"])


async def _enrich(schedule: Schedule, db: AsyncSession) -> ScheduleResponse:
    repo = ScheduleRepository(db)
    last = await repo.get_last_success(schedule.id)
    resp = ScheduleResponse.model_validate(schedule)
    if last:
        resp.last_fired_at = last.fired_at
        resp.last_status   = last.status
    return resp


async def _get_or_404(schedule_id: uuid.UUID, db: AsyncSession) -> Schedule:
    schedule = await ScheduleRepository(db).get_by_id(schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return schedule


@router.get("", response_model=List[ScheduleResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    schedules = await ScheduleRepository(db).get_all()
    return [await _enrich(s, db) for s in schedules]


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    schedule = await ScheduleRepository(db).create(data.model_dump())
    add_schedule_job(schedule)
    return await _enrich(schedule, db)


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    schedule = await _get_or_404(schedule_id, db)
    return await _enrich(schedule, db)


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: uuid.UUID,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    schedule = await _get_or_404(schedule_id, db)
    schedule = await ScheduleRepository(db).update(schedule, data.model_dump(exclude_none=True))
    sync_schedule_job(schedule)
    return await _enrich(schedule, db)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    schedule = await _get_or_404(schedule_id, db)
    remove_schedule_job(schedule.id)
    await ScheduleRepository(db).delete(schedule)


@router.post("/{schedule_id}/run-now")
async def run_now(
    schedule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
):
    await _get_or_404(schedule_id, db)
    from app.scheduler.jobs import digest_job
    asyncio.create_task(digest_job(schedule_id, force=True))
    return {"ok": True, "fired_at": datetime.now(UTC).isoformat()}
