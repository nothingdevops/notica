import { useNavigate } from 'react-router-dom'
import { cn, formatRelative } from '@/lib/utils'
import { HistoryStrip } from './HistoryStrip'
import type { JobListItem } from '../types'

const STATUS_DOT_COLOR: Record<string, string> = {
  success: 'var(--success)',
  failure: 'var(--failure)',
  warning: 'var(--warning)',
  skipped: 'var(--skipped)',
  missed:  '#f97316',
}

interface JobCardProps {
  job: JobListItem
}

export function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate()
  const tagEntries = Object.entries(job.tags).slice(0, 3)

  return (
    <div
      onClick={() => navigate(`/jobs/${job.id}`)}
      className={cn(
        'cursor-pointer rounded-[7px] border bg-[var(--bg-card)] p-[10px_12px] transition-colors hover:border-[var(--text-3)]',
        job.last_status === 'failure' && 'border-[rgba(239,68,68,0.2)]',
        job.is_overdue && job.last_status !== 'failure' && 'border-[rgba(245,158,11,0.2)] opacity-85',
        job.last_status !== 'failure' && !job.is_overdue && 'border-[var(--border)]',
      )}
    >
      {/* Header */}
      <div className="mb-[7px] flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] font-semibold text-[var(--text-1)]">
            {job.name}
          </div>
          <div className="mt-0.5 truncate text-[9px] text-[var(--text-3)]">
            {tagEntries.map(([k, v]) => `${k}:${v}`).join(' · ') || ' '}
          </div>
        </div>
        <div
          className="mt-[3px] h-[6px] w-[6px] shrink-0 rounded-full"
          style={{
            background: job.last_status
              ? STATUS_DOT_COLOR[job.last_status]
              : 'var(--text-3)',
          }}
        />
      </div>

      {/* History strip */}
      <div className="mb-[7px]">
        <HistoryStrip statuses={job.recent_statuses} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {job.is_overdue ? (
          <span className="font-mono text-[9px]" style={{ color: 'var(--warning)' }}>
            overdue
          </span>
        ) : (
          <span className="font-mono text-[9px] text-[var(--text-3)]">
            {job.last_run_at ? formatRelative(job.last_run_at) : 'no runs'}
          </span>
        )}
        {job.expected_cron && (
          <span className="font-mono text-[9px] text-[var(--text-3)]">
            {job.expected_cron}
          </span>
        )}
      </div>
    </div>
  )
}
