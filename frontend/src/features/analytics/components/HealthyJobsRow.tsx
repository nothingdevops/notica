import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HealthyJobSummary } from '../types'

const ENV_BADGE: Record<string, string> = {
  prod:    'bg-red-900/20 text-red-400 border border-red-800/30',
  staging: 'bg-amber-900/20 text-amber-400 border border-amber-800/30',
  dev:     'bg-blue-900/20 text-blue-400 border border-blue-800/30',
  dr:      'bg-green-900/20 text-green-400 border border-green-800/30',
  other:   'bg-violet-900/30 text-violet-400 border border-violet-700/40',
}

interface Props {
  count: number
  jobs: HealthyJobSummary[]
  loading?: boolean
  periodLabel?: string
}

export function HealthyJobsRow({ count, jobs, loading, periodLabel = '7d' }: Props) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  if (loading || count === 0) return null

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-shrink-0"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <div>
            <span className="text-sm font-semibold text-[var(--text-1)]">
              {count} healthy {count === 1 ? 'job' : 'jobs'}
            </span>
            <p className="text-[11px] text-[var(--text-3)]">No failures in the past {periodLabel}</p>
          </div>
        </div>
        <span className="text-[var(--accent)] text-sm select-none">
          {expanded ? 'Collapse ↑' : 'Expand all ↓'}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)]">
          {jobs.map(job => (
            <div
              key={job.job_id}
              className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-elevated)] cursor-pointer transition-colors group"
              onClick={() => navigate(`/jobs/${job.job_id}`)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-sm text-[var(--text-1)] flex-1 truncate">{job.job_name}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${ENV_BADGE[job.env] ?? ENV_BADGE.other}`}
              >
                {job.env}
              </span>
              <span className="text-[var(--accent)] text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                →
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
