from collections.abc import AsyncGenerator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.jobs import Job
from app.db.session import async_session


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


async def verify_job_token(
    x_job_token: str = Header(..., alias="X-Job-Token"),
    db: AsyncSession = Depends(get_db),
) -> Job:
    result = await db.execute(
        select(Job).where(Job.token == x_job_token, Job.active.is_(True))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or inactive job token",
        )
    return job
