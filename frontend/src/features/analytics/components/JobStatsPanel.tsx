import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useJobStats } from '../api'
import { StatusBarChart } from './StatusBarChart'
import { DurationLineChart } from './DurationLineChart'
import type { Period } from '../types'

interface Props {
  jobId: string
}

const PERIODS: Period[] = [7, 30, 90]

function successRateColor(rate: number): string {
  if (rate >= 90) return 'var(--success)'
  if (rate >= 70) return 'var(--warning)'
  return 'var(--failure)'
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </span>
      <div className="flex-1 border-t border-[var(--border)]" />
    </div>
  )
}

export function JobStatsPanel({ jobId }: Props) {
  const [period, setPeriod] = useState<Period>(7)
  const { data, isLoading } = useJobStats(jobId, period)

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
          Health Analytics
        </h2>

        {/* Period selector — pill shape, active has colored bg */}
        <div className="flex gap-1 rounded-full bg-[var(--bg-elevated)] p-0.5">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="rounded-full px-3 py-1 font-mono text-[10px] font-medium transition-colors"
              style={
                period === p
                  ? {
                      background: 'var(--accent-bg)',
                      color: 'var(--accent)',
                    }
                  : {
                      background: 'transparent',
                      color: 'var(--text-3)',
                    }
              }
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[var(--bg-elevated)] px-4 py-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">
            Success rate
          </p>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p
              className="text-2xl font-semibold tabular-nums"
              style={{ color: data ? successRateColor(data.success_rate) : 'var(--text-3)' }}
            >
              {data ? `${data.success_rate}%` : '—'}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-[var(--bg-elevated)] px-4 py-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">
            Total runs
          </p>
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-2xl font-semibold tabular-nums text-[var(--text-1)]">
              {data ? data.total_runs : '—'}
            </p>
          )}
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex flex-col gap-6">
          <div>
            <Skeleton className="mb-3 h-3 w-32" />
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="mb-3 h-3 w-36" />
            <Skeleton className="h-[180px] w-full rounded-lg" />
          </div>
        </div>
      ) : data ? (
        <div className="flex flex-col gap-6">
          <div>
            <SectionDivider label="Alert volume by day" />
            <div className="mt-3">
              <StatusBarChart data={data.daily_status} />
            </div>
          </div>

          <div>
            <SectionDivider label="Avg duration (seconds)" />
            <div className="mt-3">
              <DurationLineChart data={data.daily_duration} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
