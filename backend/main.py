from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes import alerts, analytics, assets, contacts, jobs, schedules, settings, sso
from app.core.config import settings as config
from app.core.dependencies import get_db
from app.core.logging_config import setup_logging
from app.core.middleware import RequestIdMiddleware
from app.scheduler.setup import get_scheduler, start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(config.log_level)
    await start_scheduler()
    yield
    get_scheduler().shutdown(wait=False)


app = FastAPI(
    title="Notica API",
    version="0.1.0",
    description="Centralized alert & notification system for backup jobs",
    lifespan=lifespan,
)

cors_origins = (
    [config.app_url, "http://localhost:5173"]
    if config.sso_enabled
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIdMiddleware)

app.include_router(jobs.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(contacts.router, prefix="/api/v1")
app.include_router(schedules.router, prefix="/api/v1")
app.include_router(settings.router, prefix="/api/v1")
app.include_router(sso.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "service": "notica"}
