import type { EnvHealthItem } from '../types'

interface Props {
  envHealth: EnvHealthItem[]
  loading?: boolean
}

function healthColors(successRate: number, failingJobs: number): {
  dot: string
  bar: string
  textClass: string
} {
  if (failingJobs > 0 && successRate < 50) {
    return { dot: '#ef4444', bar: '#ef4444', textClass: 'text-red-400' }
  }
  if (failingJobs > 0 && successRate < 80) {
    return { dot: '#f59e0b', bar: '#f59e0b', textClass: 'text-amber-400' }
  }
  return { dot: '#22c55e', bar: '#22c55e', textClass: 'text-green-400' }
}

function sparkBarColor(failureRate: number): string {
  if (failureRate === 0) return '#22c55e'
  if (failureRate < 0.25) return '#86efac'
  if (failureRate < 0.5) return '#f59e0b'
  if (failureRate < 0.75) return '#f97316'
  return '#ef4444'
}

export function EnvHealthGrid({ envHealth, loading }: Props) {
  if (loading) {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)] mb-3">
          Health by Environment
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-[var(--bg-elevated)] rounded mb-3" />
              <div className="h-7 bg-[var(--bg-elevated)] rounded mb-2" />
              <div className="h-1.5 bg-[var(--bg-elevated)] rounded mb-2" />
              <div className="h-3 bg-[var(--bg-elevated)] rounded w-24 mb-3" />
              <div className="h-6 bg-[var(--bg-elevated)] rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (envHealth.length === 0) return null

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)] mb-3">
        Health by Environment
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {envHealth.map(item => {
          const colors = healthColors(item.success_rate, item.failing_jobs)
          return (
            <div
              key={item.env}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4"
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: colors.dot }}
                  />
                  <span className="text-[11px] font-bold text-[var(--text-1)] uppercase tracking-wider">
                    {item.env}
                  </span>
                </div>
                <span className={`text-sm font-bold tabular-nums ${colors.textClass}`}>
                  {item.success_rate.toFixed(0)}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-[var(--bg-elevated)] rounded-full mb-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.success_rate}%`, background: colors.bar }}
                />
              </div>

              {/* Subtitle */}
              <p className="text-[10px] text-[var(--text-3)] mb-3">
                {item.total_jobs} jobs · {item.failing_jobs} failing
              </p>

              {/* Sparkline — 7 bars, height proportional to failure rate */}
              <div className="flex gap-0.5 items-end h-6">
                {item.daily_spark.map((pt, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      background: sparkBarColor(pt.failure_rate),
                      height: `${20 + pt.failure_rate * 80}%`,
                      opacity: 0.85,
                    }}
                    title={`${pt.day}: ${(pt.failure_rate * 100).toFixed(0)}% failure rate`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
