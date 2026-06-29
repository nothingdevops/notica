import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProblemJobItem, DailyStatusPoint } from '../types'

interface Props {
  jobs: ProblemJobItem[]
  loading?: boolean
  onJobClick?: (id: string) => void
}

const ENV_BADGE: Record<string, string> = {
  prod:    'bg-red-900/20 text-red-400 border border-red-800/30',
  staging: 'bg-amber-900/20 text-amber-400 border border-amber-800/30',
  dev:     'bg-blue-900/20 text-blue-400 border border-blue-800/30',
  dr:      'bg-green-900/20 text-green-400 border border-green-800/30',
  other:   'bg-violet-900/30 text-violet-400 border border-violet-700/40',
}

function successRateColor(rate: number): string {
  if (rate >= 90) return 'text-green-400'
  if (rate >= 70) return 'text-amber-400'
  return 'text-red-400'
}

function dayCellColor(day: DailyStatusPoint): string {
  if (day.failure >= 5) return '#ef4444'
  if (day.failure >= 3) return '#ef4444aa'
  if (day.failure >= 1) return '#ef444470'
  if (day.success > 0) return '#22c55e80'
  if (day.warning > 0) return '#f59e0b80'
  return 'var(--border)'
}

function fmtRelative(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function ProblemJobsTable({ jobs, loading, onJobClick }: Props) {
  const navigate = useNavigate()
  const [showAll, setShowAll] = useState(false)

  if (loading) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5">
        <div className="h-4 bg-[var(--bg-elevated)] rounded w-36 mb-1 animate-pulse" />
        <div className="h-3 bg-[var(--bg-elevated)] rounded w-48 mb-4 animate-pulse" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-[var(--bg-elevated)] rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (jobs.length === 0) return null

  const visible = showAll ? jobs : jobs.slice(0, 5)
  const remaining = jobs.length - 5

  function handleRowClick(job: ProblemJobItem) {
    if (onJobClick) {
      onJobClick(job.job_id)
    } else {
      navigate(`/jobs/${job.job_id}`)
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[10px] font-bold text-[var(--text-1)] uppercase tracking-wider">
          Problem Jobs
        </h3>
        <p className="text-[10px] text-[var(--text-3)] mt-0.5">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} with failures in the past 7 days
        </p>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="border-t border-[var(--border)]">
            <th className="text-left px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Job
            </th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Rate (7d)
            </th>
            <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Failures
            </th>
            <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Trend
            </th>
            <th className="text-right px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Last run
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map(job => (
            <tr
              key={job.job_id}
              className="border-t border-[var(--border)] hover:bg-[var(--bg-elevated)] cursor-pointer group transition-colors"
              onClick={() => handleRowClick(job)}
            >
              {/* Job name + env badge */}
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-[var(--text-1)] truncate max-w-[180px]"
                    title={job.job_name}
                  >
                    {job.job_name}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${ENV_BADGE[job.env] ?? ENV_BADGE.other}`}
                  >
                    {job.env}
                  </span>
                </div>
              </td>

              {/* Success rate */}
              <td className="px-3 py-3 text-right">
                <span className={`font-semibold tabular-nums ${successRateColor(job.success_rate)}`}>
                  {job.success_rate.toFixed(0)}%
                </span>
              </td>

              {/* Failure count / total */}
              <td className="px-3 py-3 text-right">
                <span className="font-bold tabular-nums text-red-400">{job.failure_count}</span>
                <span className="text-[var(--text-3)]">/{job.total_runs}</span>
              </td>

              {/* 7-day mini heatmap */}
              <td className="px-3 py-3">
                <div className="flex gap-0.5">
                  {job.daily_status.map((day, i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                      style={{ background: dayCellColor(day) }}
                      title={`${day.day}: ${day.failure}✗ ${day.success}✓`}
                    />
                  ))}
                </div>
              </td>

              {/* Last run + hover arrow */}
              <td className="px-5 py-3 text-right whitespace-nowrap">
                <span className="text-[var(--text-3)]">{fmtRelative(job.last_alert_at)}</span>
                <span className="ml-2 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!showAll && remaining > 0 && (
        <div className="border-t border-[var(--border)] px-5 py-2.5">
          <button
            onClick={e => { e.stopPropagation(); setShowAll(true) }}
            className="text-[11px] text-[var(--accent)] hover:underline"
          >
            Show {remaining} more
          </button>
        </div>
      )}
    </div>
  )
}
