# C1 — Job Health Dashboard Implementation Plan

> **STATUS: IMPLEMENTED** ✅ — 2026-06-28
> Một số thay đổi so với plan gốc: OverviewResponse dùng `success_rate`/`total_alerts` (không có `_7d` suffix vì field phụ thuộc vào period), thêm `EnvHealthItem`, `ProblemJobItem`, `HealthyJobSummary` cho Progressive Disclosure design. `AnalyticsPage` được redesign hoàn toàn theo pattern KPI strip → Env Health → Problem Jobs → Healthy Jobs → Charts.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm analytics dashboard vào Notica — trang `/analytics` cho system-wide overview và section per-job charts trên Job Detail page, với time range 7d / 30d / 90d.

**Architecture:** Backend thêm 2 endpoints aggregate query trực tiếp trên bảng `alerts` (PostgreSQL `DATE_TRUNC` + `COUNT`/`AVG`), không thêm bảng mới. Frontend thêm feature `analytics/` với Recharts, trang `/analytics` mới trong sidebar, và `JobStatsPanel` nhúng vào `JobDetailPage`.

**Tech Stack:** FastAPI + SQLAlchemy async (backend), Recharts 2.x + React Query (frontend), PostgreSQL `date_trunc` aggregation.

## Global Constraints

- Python async/await everywhere — không dùng `Session`, chỉ `AsyncSession`
- Frontend follow CSS variable system: `--success #22c55e`, `--failure #ef4444`, `--warning #f59e0b`, `--skipped #64748b` — dùng cho màu chart
- API prefix `/api/v1/` — tất cả analytics endpoints nằm dưới prefix này
- Recharts version `^2.x` — không dùng v3 (API khác biệt)
- Không thêm migration — không model mới, chỉ aggregate query trên bảng hiện có
- Follow pattern query key: `queryKeys.analytics.overview()`, `queryKeys.analytics.job(id, period)`
- Chart container luôn dùng `<ResponsiveContainer width="100%" height={200}>`
- Date label trên X-axis format `MMM d` (vd: "Jun 28") từ ISO string `YYYY-MM-DD`

---

## File Structure

### Backend — tạo mới
```
backend/app/schemas/analytics.py        # Pydantic response schemas
backend/app/repositories/analytics.py  # Aggregation queries (DATE_TRUNC, COUNT, AVG)
backend/app/api/v1/routes/analytics.py # 2 GET endpoints: /analytics/overview, /analytics/jobs/{id}
```

### Backend — sửa
```
backend/main.py                         # Thêm include_router(analytics.router)
```

### Frontend — tạo mới
```
frontend/src/features/analytics/types.ts                        # TypeScript interfaces
frontend/src/features/analytics/api.ts                          # useOverview(), useJobStats() hooks
frontend/src/features/analytics/components/StatCard.tsx         # Stat card (number + label)
frontend/src/features/analytics/components/StatusBarChart.tsx   # Stacked bar chart by status/day
frontend/src/features/analytics/components/DurationLineChart.tsx # Avg duration trend line chart
frontend/src/features/analytics/components/TopFailingJobs.tsx   # Top 5 failing jobs list
frontend/src/features/analytics/components/JobStatsPanel.tsx    # Per-job composite panel
frontend/src/features/analytics/pages/AnalyticsPage.tsx         # /analytics route page
```

### Frontend — sửa
```
frontend/src/lib/queryKeys.ts                          # Thêm analytics keys
frontend/src/router.tsx                                # Thêm /analytics route
frontend/src/components/layout/Sidebar.tsx            # Thêm Analytics nav item
frontend/src/features/jobs/pages/JobDetailPage.tsx    # Nhúng JobStatsPanel section
```

---

## Task 1 — Backend: Schemas + Repository

**Files:**
- Create: `backend/app/schemas/analytics.py`
- Create: `backend/app/repositories/analytics.py`
- Test: `backend/tests/test_analytics_repo.py`

**Interfaces:**
- Produces:
  - `DailyStatusPoint`, `DailyDurationPoint`, `TopFailingJob`, `JobStatsResponse`, `OverviewResponse` (schemas)
  - `AnalyticsRepository.get_job_stats(job_id, period_days)` → `JobStatsResponse`
  - `AnalyticsRepository.get_overview()` → `OverviewResponse`

- [ ] **Step 1: Tạo schemas**

Tạo `backend/app/schemas/analytics.py`:

```python
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
```

- [ ] **Step 2: Viết failing tests**

Tạo `backend/tests/test_analytics_repo.py`:

```python
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
```

- [ ] **Step 3: Chạy tests — xác nhận FAIL**

```bash
cd backend
pytest tests/test_analytics_repo.py -v 2>&1 | head -30
```

Expected: `ImportError: cannot import name 'AnalyticsRepository'`

- [ ] **Step 4: Implement repository**

Tạo `backend/app/repositories/analytics.py`:

```python
from __future__ import annotations
import uuid
from datetime import datetime, timedelta, timezone
from collections import defaultdict

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.alerts import Alert
from app.db.models.jobs import Job
from app.schemas.analytics import (
    DailyDurationPoint,
    DailyStatusPoint,
    JobStatsResponse,
    OverviewResponse,
    TopFailingJob,
)

UTC = timezone.utc
STATUSES = ("success", "failure", "warning", "skipped")


def _cutoff(days: int) -> datetime:
    return datetime.now(UTC) - timedelta(days=days)


def _iso_day(dt: datetime) -> str:
    """Convert datetime to YYYY-MM-DD string (UTC)."""
    return dt.astimezone(UTC).strftime("%Y-%m-%d")


class AnalyticsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_job_stats(self, job_id: uuid.UUID, period_days: int) -> JobStatsResponse:
        since = _cutoff(period_days)

        # --- Daily status counts ---
        rows = await self.db.execute(
            select(
                func.date_trunc("day", Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.job_id == job_id, Alert.received_at >= since)
            .group_by(func.date_trunc("day", Alert.received_at), Alert.status)
            .order_by(func.date_trunc("day", Alert.received_at))
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
                func.date_trunc("day", Alert.received_at).label("day"),
                func.avg(Alert.duration_sec).label("avg_dur"),
            )
            .where(
                Alert.job_id == job_id,
                Alert.received_at >= since,
                Alert.duration_sec.is_not(None),
            )
            .group_by(func.date_trunc("day", Alert.received_at))
            .order_by(func.date_trunc("day", Alert.received_at))
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

    async def get_overview(self) -> OverviewResponse:
        since = _cutoff(7)

        # --- Job counts ---
        job_counts = await self.db.execute(
            select(
                func.count().label("total"),
                func.count().filter(Job.active == True).label("active"),  # noqa: E712
            )
        )
        jc = job_counts.one()

        # --- System-wide daily status (7d) ---
        rows = await self.db.execute(
            select(
                func.date_trunc("day", Alert.received_at).label("day"),
                Alert.status,
                func.count().label("cnt"),
            )
            .where(Alert.received_at >= since)
            .group_by(func.date_trunc("day", Alert.received_at), Alert.status)
            .order_by(func.date_trunc("day", Alert.received_at))
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

        return OverviewResponse(
            total_jobs=jc.total,
            active_jobs=jc.active,
            success_rate_7d=success_rate_7d,
            total_alerts_7d=total_7d,
            daily_status=daily_status,
            top_failing_jobs=top_failing,
        )
```

- [ ] **Step 5: Chạy tests — xác nhận PASS**

```bash
cd backend
pytest tests/test_analytics_repo.py -v
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/analytics.py backend/app/repositories/analytics.py backend/tests/test_analytics_repo.py
git commit -m "feat(analytics): add schemas and repository for job health dashboard"
```

---

## Task 2 — Backend: Analytics Route

**Files:**
- Create: `backend/app/api/v1/routes/analytics.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: `AnalyticsRepository` (Task 1)
- Produces:
  - `GET /api/v1/analytics/overview` → `OverviewResponse`
  - `GET /api/v1/analytics/jobs/{job_id}?period=7` → `JobStatsResponse`

- [ ] **Step 1: Tạo route**

Tạo `backend/app/api/v1/routes/analytics.py`:

```python
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_auth
from app.core.dependencies import get_db
from app.repositories.analytics import AnalyticsRepository
from app.schemas.analytics import JobStatsResponse, OverviewResponse

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
) -> OverviewResponse:
    return await AnalyticsRepository(db).get_overview()


@router.get("/jobs/{job_id}", response_model=JobStatsResponse)
async def get_job_stats(
    job_id: uuid.UUID,
    period: int = Query(7, ge=1, le=90, description="Period in days: 7, 30, or 90"),
    db: AsyncSession = Depends(get_db),
    _: dict[str, Any] = Depends(require_auth),
) -> JobStatsResponse:
    return await AnalyticsRepository(db).get_job_stats(job_id, period_days=period)
```

- [ ] **Step 2: Register router trong main.py**

Mở `backend/main.py`, thêm 2 dòng sau phần import và include_router hiện có:

```python
# Thêm vào import block (cùng với các router khác):
from app.api.v1.routes import analytics

# Thêm sau dòng include_router cuối cùng:
app.include_router(analytics.router, prefix="/api/v1")
```

- [ ] **Step 3: Smoke test endpoint**

```bash
cd backend
uvicorn main:app --reload --port 8000 &
sleep 2
curl -s http://localhost:8000/api/v1/analytics/overview | python3 -m json.tool | head -20
# Expected: JSON với total_jobs, active_jobs, success_rate_7d, ...
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/v1/routes/analytics.py backend/main.py
git commit -m "feat(analytics): add /analytics/overview and /analytics/jobs/{id} endpoints"
```

---

## Task 3 — Frontend: Types + QueryKeys + API Hooks

**Files:**
- Create: `frontend/src/features/analytics/types.ts`
- Create: `frontend/src/features/analytics/api.ts`
- Modify: `frontend/src/lib/queryKeys.ts`

**Interfaces:**
- Produces:
  - `useOverview()` → `UseQueryResult<OverviewResponse>`
  - `useJobStats(jobId, period)` → `UseQueryResult<JobStatsResponse>`

- [ ] **Step 1: Install recharts**

```bash
cd frontend
npm install recharts@^2.15
```

Expected output: `added N packages`

- [ ] **Step 2: Tạo types**

Tạo `frontend/src/features/analytics/types.ts`:

```typescript
export interface DailyStatusPoint {
  day: string          // "2026-06-28"
  success: number
  failure: number
  warning: number
  skipped: number
}

export interface DailyDurationPoint {
  day: string
  avg_duration: number | null
}

export interface TopFailingJob {
  job_name: string
  failure_count: number
}

export interface JobStatsResponse {
  job_id: string
  period_days: number
  success_rate: number     // 0–100
  total_runs: number
  daily_status: DailyStatusPoint[]
  daily_duration: DailyDurationPoint[]
}

export interface OverviewResponse {
  total_jobs: number
  active_jobs: number
  success_rate_7d: number  // 0–100
  total_alerts_7d: number
  daily_status: DailyStatusPoint[]
  top_failing_jobs: TopFailingJob[]
}

export type Period = 7 | 30 | 90
```

- [ ] **Step 3: Thêm analytics keys vào queryKeys**

Sửa `frontend/src/lib/queryKeys.ts` — thêm `analytics` block:

```typescript
export const queryKeys = {
  jobs: {
    all:    ['jobs'] as const,
    list:   () => [...queryKeys.jobs.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.jobs.all, id] as const,
  },
  alerts: {
    all:    ['alerts'] as const,
    list:   (filters: object) => [...queryKeys.alerts.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.alerts.all, id] as const,
  },
  analytics: {
    all:      ['analytics'] as const,
    overview: () => [...queryKeys.analytics.all, 'overview'] as const,
    job:      (id: string, period: number) => [...queryKeys.analytics.all, 'job', id, period] as const,
  },
}
```

- [ ] **Step 4: Tạo API hooks**

Tạo `frontend/src/features/analytics/api.ts`:

```typescript
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { JobStatsResponse, OverviewResponse, Period } from './types'

export function useOverview() {
  return useQuery({
    queryKey: queryKeys.analytics.overview(),
    queryFn:  () => api.get<OverviewResponse>('/analytics/overview'),
    staleTime: 60_000,  // 1 phút — analytics không cần real-time
  })
}

export function useJobStats(jobId: string, period: Period) {
  return useQuery({
    queryKey: queryKeys.analytics.job(jobId, period),
    queryFn:  () => api.get<JobStatsResponse>(`/analytics/jobs/${jobId}?period=${period}`),
    staleTime: 60_000,
    enabled:  !!jobId,
  })
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/analytics/types.ts frontend/src/features/analytics/api.ts frontend/src/lib/queryKeys.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(analytics): add types, query keys, and API hooks"
```

---

## Task 4 — Frontend: StatCard + StatusBarChart + DurationLineChart

**Files:**
- Create: `frontend/src/features/analytics/components/StatCard.tsx`
- Create: `frontend/src/features/analytics/components/StatusBarChart.tsx`
- Create: `frontend/src/features/analytics/components/DurationLineChart.tsx`

**Interfaces:**
- Consumes: `DailyStatusPoint[]`, `DailyDurationPoint[]` (từ Task 3)
- Produces: 3 UI components dùng trong Task 5+6

- [ ] **Step 1: Tạo StatCard**

Tạo `frontend/src/features/analytics/components/StatCard.tsx`:

```tsx
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-[11px] uppercase tracking-wider text-[var(--text-3)]">{label}</p>
      <p
        className="mt-1 text-2xl font-semibold"
        style={{ color: accent ? 'var(--accent)' : 'var(--text-1)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Tạo StatusBarChart**

Tạo `frontend/src/features/analytics/components/StatusBarChart.tsx`:

```tsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DailyStatusPoint } from '../types'

// Format "2026-06-28" → "Jun 28"
function fmtDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const COLORS = {
  success: '#22c55e',
  failure: '#ef4444',
  warning: '#f59e0b',
  skipped: '#64748b',
}

interface Props {
  data: DailyStatusPoint[]
  title?: string
}

export function StatusBarChart({ data, title }: Props) {
  const chartData = data.map(d => ({ ...d, day: fmtDay(d.day) }))

  return (
    <div>
      {title && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barCategoryGap="30%">
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
            width={24}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--text-1)',
            }}
          />
          <Legend
            iconSize={8}
            wrapperStyle={{ fontSize: 10, color: 'var(--text-2)', paddingTop: 8 }}
          />
          {(['success', 'failure', 'warning', 'skipped'] as const).map(s => (
            <Bar key={s} dataKey={s} stackId="a" fill={COLORS[s]} radius={s === 'skipped' ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Tạo DurationLineChart**

Tạo `frontend/src/features/analytics/components/DurationLineChart.tsx`:

```tsx
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { DailyDurationPoint } from '../types'

function fmtDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

interface Props {
  data: DailyDurationPoint[]
  title?: string
}

export function DurationLineChart({ data, title }: Props) {
  const chartData = data
    .filter(d => d.avg_duration !== null)
    .map(d => ({ day: fmtDay(d.day), duration: d.avg_duration }))

  if (chartData.length === 0) {
    return (
      <div>
        {title && (
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            {title}
          </p>
        )}
        <div className="flex h-[180px] items-center justify-center text-[11px] text-[var(--text-3)]">
          No duration data
        </div>
      </div>
    )
  }

  const avg = chartData.reduce((s, d) => s + (d.duration ?? 0), 0) / chartData.length

  return (
    <div>
      {title && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-3)' }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={v => fmtDuration(v)}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 11,
              color: 'var(--text-1)',
            }}
            formatter={(v: number) => [fmtDuration(v), 'Avg duration']}
          />
          <ReferenceLine
            y={avg}
            stroke="var(--border)"
            strokeDasharray="3 3"
          />
          <Line
            type="monotone"
            dataKey="duration"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ fill: 'var(--accent)', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/analytics/components/
git commit -m "feat(analytics): add StatCard, StatusBarChart, DurationLineChart components"
```

---

## Task 5 — Frontend: TopFailingJobs + JobStatsPanel

**Files:**
- Create: `frontend/src/features/analytics/components/TopFailingJobs.tsx`
- Create: `frontend/src/features/analytics/components/JobStatsPanel.tsx`

**Interfaces:**
- Consumes: `TopFailingJob[]`, `useJobStats()` hook, chart components từ Task 4
- Produces: `<JobStatsPanel jobId={id} />` — nhúng vào JobDetailPage (Task 7)

- [ ] **Step 1: Tạo TopFailingJobs**

Tạo `frontend/src/features/analytics/components/TopFailingJobs.tsx`:

```tsx
import type { TopFailingJob } from '../types'

interface Props {
  jobs: TopFailingJob[]
}

export function TopFailingJobs({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[11px] text-[var(--text-3)]">
        No failures in last 7 days
      </div>
    )
  }

  const max = jobs[0].failure_count

  return (
    <div className="flex flex-col gap-2">
      {jobs.map(j => (
        <div key={j.job_name} className="flex items-center gap-3">
          <span
            className="w-32 truncate font-mono text-[11px] text-[var(--text-2)]"
            title={j.job_name}
          >
            {j.job_name}
          </span>
          <div className="relative flex-1 h-2 rounded-full bg-[var(--bg-elevated)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-[var(--failure)]"
              style={{ width: `${(j.failure_count / max) * 100}%`, opacity: 0.7 }}
            />
          </div>
          <span className="w-6 text-right font-mono text-[11px] text-[var(--failure)]">
            {j.failure_count}
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Tạo JobStatsPanel**

Tạo `frontend/src/features/analytics/components/JobStatsPanel.tsx`:

```tsx
import { useState } from 'react'
import { useJobStats } from '../api'
import { StatusBarChart } from './StatusBarChart'
import { DurationLineChart } from './DurationLineChart'
import type { Period } from '../types'

interface Props {
  jobId: string
}

const PERIODS: Period[] = [7, 30, 90]

export function JobStatsPanel({ jobId }: Props) {
  const [period, setPeriod] = useState<Period>(7)
  const { data, isLoading } = useJobStats(jobId, period)

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
          Health Analytics
        </h2>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="rounded px-2 py-1 font-mono text-[10px] font-medium transition-colors"
              style={
                period === p
                  ? { background: 'var(--accent-bg)', color: 'var(--accent)' }
                  : { color: 'var(--text-3)' }
              }
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-5 flex gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Success rate</p>
          <p
            className="text-xl font-semibold"
            style={{
              color:
                !data ? 'var(--text-3)'
                : data.success_rate >= 90 ? 'var(--success)'
                : data.success_rate >= 70 ? 'var(--warning)'
                : 'var(--failure)',
            }}
          >
            {isLoading || !data ? '—' : `${data.success_rate}%`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">Total runs</p>
          <p className="text-xl font-semibold text-[var(--text-1)]">
            {isLoading || !data ? '—' : data.total_runs}
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex h-48 items-center justify-center text-[11px] text-[var(--text-3)]">
          Loading…
        </div>
      )}

      {data && !isLoading && (
        <div className="flex flex-col gap-6">
          <StatusBarChart data={data.daily_status} title="Alert volume by day" />
          <DurationLineChart data={data.daily_duration} title="Avg duration (seconds)" />
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/analytics/components/TopFailingJobs.tsx frontend/src/features/analytics/components/JobStatsPanel.tsx
git commit -m "feat(analytics): add TopFailingJobs and JobStatsPanel components"
```

---

## Task 6 — Frontend: AnalyticsPage + Router + Sidebar

**Files:**
- Create: `frontend/src/features/analytics/pages/AnalyticsPage.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `useOverview()`, `StatCard`, `StatusBarChart`, `TopFailingJobs`
- Produces: `/analytics` route hiển thị hệ thống tổng quan

- [ ] **Step 1: Tạo AnalyticsPage**

Tạo `frontend/src/features/analytics/pages/AnalyticsPage.tsx`:

```tsx
import { Topbar } from '@/components/layout/Topbar'
import { Skeleton } from '@/components/ui/skeleton'
import { useOverview } from '../api'
import { StatCard } from '../components/StatCard'
import { StatusBarChart } from '../components/StatusBarChart'
import { TopFailingJobs } from '../components/TopFailingJobs'

export function AnalyticsPage() {
  const { data, isLoading } = useOverview()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Analytics" subtitle="System-wide backup health overview" />

      <div className="flex-1 overflow-auto p-5">
        <div className="flex max-w-4xl flex-col gap-5">

          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))
            ) : (
              <>
                <StatCard label="Total jobs" value={data?.total_jobs ?? 0} />
                <StatCard label="Active jobs" value={data?.active_jobs ?? 0} />
                <StatCard
                  label="Success rate (7d)"
                  value={`${data?.success_rate_7d ?? 0}%`}
                  accent
                />
                <StatCard
                  label="Total alerts (7d)"
                  value={data?.total_alerts_7d ?? 0}
                  sub="last 7 days"
                />
              </>
            )}
          </div>

          {/* Alert volume chart */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Alert volume — last 7 days
            </p>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <StatusBarChart data={data?.daily_status ?? []} />
            )}
          </div>

          {/* Top failing jobs */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Top failing jobs — last 7 days
            </p>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <TopFailingJobs jobs={data?.top_failing_jobs ?? []} />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Thêm route vào router.tsx**

Sửa `frontend/src/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { JobBoardPage }      from '@/features/jobs/pages/JobBoardPage'
import { JobDetailPage }     from '@/features/jobs/pages/JobDetailPage'
import { AlertHistoryPage }  from '@/features/alerts/pages/AlertHistoryPage'
import { ContactsPage }      from '@/features/contacts/pages/ContactsPage'
import { SchedulesPage }     from '@/features/schedules/pages/SchedulesPage'
import { SettingsPage }      from '@/features/settings/pages/SettingsPage'
import { AnalyticsPage }     from '@/features/analytics/pages/AnalyticsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,              element: <JobBoardPage /> },
      { path: 'jobs/:id',         element: <JobDetailPage /> },
      { path: 'alerts',           element: <AlertHistoryPage /> },
      { path: 'alerts/:alertId',  element: <AlertHistoryPage /> },
      { path: 'schedules',        element: <SchedulesPage /> },
      { path: 'contacts',         element: <ContactsPage /> },
      { path: 'settings',         element: <SettingsPage /> },
      { path: 'analytics',        element: <AnalyticsPage /> },
    ],
  },
])
```

- [ ] **Step 3: Thêm Analytics vào Sidebar**

Sửa `frontend/src/components/layout/Sidebar.tsx` — thêm `BarChart2` import và nav item:

```tsx
// Thêm BarChart2 vào import lucide-react:
import { LayoutDashboard, Bell, Clock, Users, Settings, BarChart2 } from 'lucide-react'

// Thêm vào navItems array (sau Alert History):
const navItems = [
  { to: '/',           label: 'Job Board',     icon: LayoutDashboard, end: true },
  { to: '/alerts',     label: 'Alert History', icon: Bell },
  { to: '/analytics',  label: 'Analytics',     icon: BarChart2 },
  { to: '/schedules',  label: 'Schedules',     icon: Clock },
  { to: '/contacts',   label: 'Contacts',      icon: Users },
]
```

- [ ] **Step 4: Verify UI hoạt động**

```bash
cd frontend
npm run dev &
# Mở http://localhost:5173/analytics
# Confirm: trang hiển thị, 4 StatCard, chart, top failing list
kill %1
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/analytics/pages/AnalyticsPage.tsx frontend/src/router.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(analytics): add AnalyticsPage, /analytics route, and sidebar nav item"
```

---

## Task 7 — Frontend: Nhúng JobStatsPanel vào JobDetailPage

**Files:**
- Modify: `frontend/src/features/jobs/pages/JobDetailPage.tsx`

**Interfaces:**
- Consumes: `<JobStatsPanel jobId={id} />` từ Task 5

- [ ] **Step 1: Thêm import JobStatsPanel**

Trong `frontend/src/features/jobs/pages/JobDetailPage.tsx`, thêm import:

```tsx
import { JobStatsPanel } from '@/features/analytics/components/JobStatsPanel'
```

- [ ] **Step 2: Thêm section trước Save button**

Trong `JobDetailPage`, tìm section "Immediate Alerts" (Section 3) và thêm section mới ngay sau nó, trước phần `{isDirty && ...}`:

```tsx
{/* Section 4 — Health Analytics */}
<JobStatsPanel jobId={id!} />
```

Vị trí chính xác — thêm sau dòng `</section>` của "Immediate Alerts" và trước `{isDirty && (`:

```tsx
            </section>

            {/* Section 4 — Health Analytics */}
            <JobStatsPanel jobId={id!} />

            {/* Save */}
            {isDirty && (
```

- [ ] **Step 3: Verify trên Job Detail page**

```bash
cd frontend
npm run dev &
# Mở http://localhost:5173/jobs/<any-job-id>
# Confirm: section "Health Analytics" xuất hiện dưới Immediate Alerts
# Confirm: period selector 7d/30d/90d hoạt động
# Confirm: chart render đúng với data
kill %1
```

- [ ] **Step 4: TypeScript final check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/jobs/pages/JobDetailPage.tsx
git commit -m "feat(analytics): embed JobStatsPanel in Job Detail page"
```

---

## Checklist tự review

- [ ] `GET /api/v1/analytics/overview` trả đúng JSON với tất cả fields
- [ ] `GET /api/v1/analytics/jobs/{id}?period=30` hoạt động với period 7/30/90
- [ ] Trang `/analytics` hiển thị đúng — StatCards, BarChart, TopFailingJobs
- [ ] Job Detail page có section Analytics ở dưới cùng
- [ ] Period selector 7d/30d/90d trên JobStatsPanel fetch lại data
- [ ] Chart màu đúng: success=green, failure=red, warning=amber, skipped=gray
- [ ] Empty state hiển thị khi không có data (job mới, chưa có alert)
- [ ] `npx tsc --noEmit` clean
- [ ] `pytest tests/test_analytics_repo.py -v` all pass
- [ ] Không có N+1 query — mỗi endpoint chỉ gọi DB đúng số lần cần thiết
