import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { DailyStatusPoint } from '../types'

function fmtDay(day: string): string {
  const d = new Date(day + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

const COLORS = {
  success: '#22c55e',
  failure: '#ef4444',
  warning: '#f59e0b',
  skipped: '#64748b',
} as const

type StatusKey = keyof typeof COLORS

interface Props {
  data: DailyStatusPoint[]
  title?: string
  height?: number
}

export function StatusBarChart({ data, title, height = 180 }: Props) {
  const chartData = data.map(d => ({ ...d, day: fmtDay(d.day) }))

  return (
    <div>
      {title && (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} barCategoryGap="30%" barSize={14}>
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
              borderRadius: 8,
              fontSize: 11,
              color: 'var(--text-1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              padding: '8px 12px',
            }}
            labelStyle={{ color: 'var(--text-2)', marginBottom: 4 }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Legend
            iconSize={8}
            iconType="circle"
            wrapperStyle={{ fontSize: 10, color: 'var(--text-2)', paddingTop: 8 }}
          />
          {(['success', 'failure', 'warning', 'skipped'] as StatusKey[]).map(s => (
            <Bar
              key={s}
              dataKey={s}
              stackId="a"
              fill={COLORS[s]}
              radius={s === 'skipped' ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              animationDuration={600}
              isAnimationActive={true}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
