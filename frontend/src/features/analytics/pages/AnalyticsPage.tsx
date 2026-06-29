import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOverview } from '../api'
import type { Period } from '../types'
import { EnvHealthGrid } from '../components/EnvHealthGrid'
import { HealthyJobsRow } from '../components/HealthyJobsRow'
import { ProblemJobsTable } from '../components/ProblemJobsTable'
import { StatusBarChart } from '../components/StatusBarChart'
import { DurationLineChart } from '../components/DurationLineChart'

// ─── Local helpers ─────────────────────────────────────────────────────────────

function successRateColor(rate?: number): string {
  if (rate === undefined) return 'text-[var(--text-1)]'
  if (rate >= 90) return 'text-green-400'
  if (rate >= 70) return 'text-amber-400'
  return 'text-red-400'
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

// ─── KPI building blocks ───────────────────────────────────────────────────────

interface KpiCellProps {
  label: string
  loading: boolean
  children: React.ReactNode
  last?: boolean
}

function KpiCell({ label, loading, children, last }: KpiCellProps) {
  return (
    <div className={`px-6 py-4 ${last ? '' : 'border-r border-[var(--border)]'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)] mb-2">
        {label}
      </p>
      {loading ? (
        <div className="h-8 animate-pulse rounded bg-[var(--bg-elevated)]" />
      ) : (
        <div className="flex items-baseline gap-2 flex-wrap">{children}</div>
      )}
    </div>
  )
}

interface KpiBadgeProps {
  color: string
  label: string
}

function KpiBadge({ color, label }: KpiBadgeProps) {
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: color + '22', color }}
    >
      {label}
    </span>
  )
}

const PERIODS: Period[] = [7, 30, 90]

// ─── Page ──────────────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7)
  const { data, isLoading } = useOverview(period)
  const navigate = useNavigate()

  const avgDuration = useMemo(() => {
    if (!data?.daily_duration) return null
    const vals = data.daily_duration
      .filter(d => d.avg_duration !== null)
      .map(d => d.avg_duration as number)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [data?.daily_duration])

  const rate = data?.success_rate
  const rateColor = rate !== undefined
    ? (rate >= 90 ? '#22c55e' : rate >= 70 ? '#f59e0b' : '#ef4444')
    : '#818cf8'
  const rateLabel = rate !== undefined
    ? (rate >= 90 ? 'On target' : rate >= 70 ? 'Near target' : 'Critical')
    : '—'

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-start justify-between px-7 py-5 border-b border-[var(--border)] flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-1)]">Analytics</h1>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            {data ? `${data.total_jobs} jobs monitored` : 'Loading…'} · Last updated just now
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-[var(--bg-base)] border border-[var(--border)] rounded-lg p-1 gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  period === p
                    ? 'bg-[var(--bg-elevated)] text-[var(--accent)]'
                    : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Strip — 5 cells ── */}
      <div className="grid grid-cols-5 border-b border-[var(--border)] flex-shrink-0">

        {/* 1. Success Rate */}
        <KpiCell label="Success Rate" loading={isLoading}>
          <span className={`text-3xl font-bold tabular-nums leading-none ${successRateColor(data?.success_rate)}`}>
            {data ? `${data.success_rate.toFixed(0)}%` : '—'}
          </span>
          <KpiBadge color={rateColor} label={rateLabel} />
          <span className="text-[var(--text-3)] text-[10px] w-full">target 90%</span>
        </KpiCell>

        {/* 2. Total Jobs */}
        <KpiCell label="Total Jobs" loading={isLoading}>
          <span className="text-3xl font-bold tabular-nums leading-none text-[var(--text-1)]">
            {data?.total_jobs ?? '—'}
          </span>
          <span className="text-[10px] text-[var(--text-3)]">
            {data ? `${data.active_jobs} active` : ''}
          </span>
        </KpiCell>

        {/* 3. Failing Now */}
        <KpiCell label="Failing Now" loading={isLoading}>
          <span
            className={`text-3xl font-bold tabular-nums leading-none ${
              (data?.failing_jobs_count ?? 0) > 0 ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {data?.failing_jobs_count ?? '—'}
          </span>
          {data && data.failing_jobs_count === 0 && (
            <span className="text-[10px] text-green-400">All healthy</span>
          )}
        </KpiCell>

        {/* 4. Alerts (period) */}
        <KpiCell label={`Alerts ${period}d`} loading={isLoading}>
          <span className="text-3xl font-bold tabular-nums leading-none text-[var(--text-1)]">
            {data?.total_alerts ?? '—'}
          </span>
          <span className="text-[10px] text-[var(--text-3)]">total runs</span>
        </KpiCell>

        {/* 5. Avg Duration */}
        <KpiCell label="Avg Duration" loading={isLoading} last>
          <span className="text-3xl font-bold tabular-nums leading-none text-[var(--text-1)]">
            {avgDuration !== null ? fmtDuration(avgDuration) : '—'}
          </span>
          <span className="text-[10px] text-[var(--text-3)]">system-wide</span>
        </KpiCell>

      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto p-7 space-y-4">

        {/* Health by Environment */}
        <EnvHealthGrid envHealth={data?.env_health ?? []} loading={isLoading} />

        {/* Problem Jobs */}
        <ProblemJobsTable
          jobs={data?.problem_jobs ?? []}
          loading={isLoading}
          onJobClick={id => navigate(`/jobs/${id}`)}
        />

        {/* Healthy jobs collapsed row */}
        <HealthyJobsRow
          count={data?.healthy_jobs_count ?? 0}
          jobs={data?.healthy_jobs ?? []}
          loading={isLoading}
          periodLabel={`${period}d`}
        />

        {/* Charts row */}
        <div className="grid grid-cols-[3fr_2fr] gap-3">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--text-1)]">Alert Volume</h3>
            <p className="text-xs text-[var(--text-3)] mb-4">
              Stacked by status · all jobs · last {period} days
            </p>
            <StatusBarChart data={data?.daily_status ?? []} height={140} />
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
            <h3 className="text-sm font-bold text-[var(--text-1)]">Avg Duration Trend</h3>
            <p className="text-xs text-[var(--text-3)] mb-4">System-wide · last {period} days</p>
            <DurationLineChart data={data?.daily_duration ?? []} height={140} />
          </div>
        </div>

      </div>
    </div>
  )
}
