import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { JobListItem } from '@/features/jobs/types'
import type { AlertFilters } from '../types'

const STATUSES = ['success', 'failure', 'warning', 'skipped']

const STATUS_ACTIVE_CLASS: Record<string, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  failure: 'bg-[var(--failure-bg)] text-[var(--failure)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  skipped: 'bg-[var(--skipped-bg)] text-[var(--skipped)]',
}

const QUICK_PRESETS = [
  { label: '1d',  days: 1 },
  { label: '3d',  days: 3 },
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
]

const DAY_FMT = 'yyyy-MM-dd'

interface AlertFiltersProps {
  filters: AlertFilters
  onChange: (f: Partial<AlertFilters>) => void
  onClear: () => void
}

export function AlertFilters({ filters, onChange, onClear }: AlertFiltersProps) {
  const { data: jobs = [] } = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn:  () => api.get<JobListItem[]>('/jobs'),
  })

  const hasFilters = !!(
    filters.job_id ||
    filters.status?.length ||
    filters.date_from ||
    filters.date_to
  )

  function toggleStatus(s: string) {
    const current = filters.status ?? []
    const next = current.includes(s)
      ? current.filter(v => v !== s)
      : [...current, s]
    onChange({ status: next.length ? next : undefined, page: 1 })
  }

  function applyPreset(days: number) {
    const today = new Date()
    onChange({
      date_from: format(subDays(today, days), DAY_FMT),
      date_to:   format(today, DAY_FMT),
      page: 1,
    })
  }

  function isPresetActive(days: number) {
    const today = new Date()
    return (
      filters.date_from === format(subDays(today, days), DAY_FMT) &&
      filters.date_to   === format(today, DAY_FMT)
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Job */}
      <Select
        value={filters.job_id ?? ''}
        onChange={e => onChange({ job_id: e.target.value || undefined, page: 1 })}
        className="w-40"
      >
        <option value="">All jobs</option>
        {jobs.map(j => (
          <option key={j.id} value={j.id}>{j.name}</option>
        ))}
      </Select>

      {/* Status toggles */}
      <div className="flex gap-1">
        {STATUSES.map(s => {
          const active = filters.status?.includes(s)
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={[
                'rounded px-2 py-1 font-mono text-[10px] uppercase transition-colors border',
                active
                  ? `${STATUS_ACTIVE_CLASS[s]} border-transparent font-semibold`
                  : 'text-[var(--text-3)] border-[var(--border)] hover:text-[var(--text-2)]',
              ].join(' ')}
            >
              {s}
            </button>
          )
        })}
      </div>

      {/* Divider */}
      <span className="text-[var(--border)]">|</span>

      {/* Quick presets */}
      <div className="flex gap-1">
        {QUICK_PRESETS.map(({ label, days }) => {
          const active = isPresetActive(days)
          return (
            <button
              key={label}
              onClick={() => applyPreset(days)}
              className={[
                'rounded px-2.5 py-1 font-mono text-[10px] font-medium transition-colors border',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)] hover:border-[var(--text-3)]',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Manual date range */}
      <Input
        type="date"
        value={filters.date_from ?? ''}
        onChange={e => onChange({ date_from: e.target.value || undefined, page: 1 })}
        className="w-34"
        title="From"
      />
      <span className="text-[11px] text-[var(--text-3)]">→</span>
      <Input
        type="date"
        value={filters.date_to ?? ''}
        onChange={e => onChange({ date_to: e.target.value || undefined, page: 1 })}
        className="w-34"
        title="To"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="gap-1">
          <X size={11} />
          Clear
        </Button>
      )}
    </div>
  )
}
