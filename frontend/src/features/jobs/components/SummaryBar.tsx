import type { JobListItem } from '../types'

interface Stat {
  label: string
  count: number
  color: string
}

interface SummaryBarProps {
  jobs: JobListItem[]
}

export function SummaryBar({ jobs }: SummaryBarProps) {
  const stats: Stat[] = [
    {
      label: 'Success',
      count: jobs.filter(j => j.last_status === 'success').length,
      color: 'var(--success)',
    },
    {
      label: 'Failed',
      count: jobs.filter(j => j.last_status === 'failure').length,
      color: 'var(--failure)',
    },
    {
      label: 'Warning',
      count: jobs.filter(j => j.last_status === 'warning').length,
      color: 'var(--warning)',
    },
    {
      label: 'Overdue',
      count: jobs.filter(j => j.is_overdue).length,
      color: 'var(--skipped)',
    },
  ]

  return (
    <div className="flex overflow-hidden rounded-[7px] border border-[var(--border)]">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="flex flex-1 items-center gap-2 bg-[var(--bg-card)] px-4 py-2.5"
          style={{ borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}
        >
          <div
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: stat.color }}
          />
          <div>
            <div className="font-mono text-[17px] font-semibold leading-none text-[var(--text-1)]">
              {stat.count}
            </div>
            <div className="mt-0.5 text-[10px] font-medium text-[var(--text-3)]">
              {stat.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
