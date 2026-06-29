interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string // hex color for accent, e.g. '#22c55e'
}

export function StatCard({ label, value, sub, color }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-shadow hover:shadow-md"
      style={color ? { borderLeftColor: color, borderLeftWidth: 3 } : undefined}
    >
      {color && (
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{ background: `linear-gradient(135deg, ${color} 0%, transparent 60%)` }}
        />
      )}
      <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-3)]">
        {label}
      </p>
      <p
        className="mt-2 text-3xl font-bold leading-none"
        style={{ color: color ?? 'var(--text-1)' }}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-[var(--text-3)]">{sub}</p>}
    </div>
  )
}
