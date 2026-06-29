import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
  height?: number
}

export function DurationLineChart({ data, title, height = 180 }: Props) {
  const chartData = data
    .filter(d => d.avg_duration !== null)
    .map(d => ({ day: fmtDay(d.day), duration: d.avg_duration }))

  const titleEl = title ? (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-2)]">
      {title}
    </p>
  ) : null

  if (chartData.length === 0) {
    return (
      <div>
        {titleEl}
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[11px] text-[var(--text-3)]"
          style={{ height }}
        >
          No duration data available
        </div>
      </div>
    )
  }

  const avg = chartData.reduce((s, d) => s + (d.duration ?? 0), 0) / chartData.length

  return (
    <div>
      {titleEl}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="durationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
            </linearGradient>
          </defs>
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
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--text-1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'var(--text-2)', marginBottom: 4 }}
            formatter={(v: number) => [fmtDuration(v), 'Avg duration']}
            cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
          />
          <ReferenceLine
            y={avg}
            stroke="var(--border)"
            strokeDasharray="3 3"
            label={{ value: `avg ${fmtDuration(Math.round(avg))}`, fontSize: 9, fill: 'var(--text-3)', position: 'insideTopRight' }}
          />
          <Area
            type="monotone"
            dataKey="duration"
            stroke="#818cf8"
            strokeWidth={2}
            fill="url(#durationGrad)"
            dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#818cf8', stroke: 'var(--bg-elevated)', strokeWidth: 2 }}
            animationDuration={600}
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
