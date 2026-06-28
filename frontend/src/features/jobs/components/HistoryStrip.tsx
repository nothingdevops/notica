const STATUS_COLOR: Record<string, string> = {
  success: 'var(--success)',
  failure: 'var(--failure)',
  warning: 'var(--warning)',
  skipped: 'var(--skipped)',
}

interface HistoryStripProps {
  statuses: string[]
}

export function HistoryStrip({ statuses }: HistoryStripProps) {
  const slots = Array.from({ length: 7 }, (_, i) => statuses[i] ?? null)

  return (
    <div className="flex gap-[3px]">
      {slots.map((status, i) => (
        <div
          key={i}
          className="h-[13px] flex-1 rounded-[2px]"
          style={{
            background: status ? STATUS_COLOR[status] ?? 'var(--text-3)' : 'var(--border)',
            opacity: status ? 0.9 : 0.3,
          }}
          title={status ?? 'no data'}
        />
      ))}
    </div>
  )
}
