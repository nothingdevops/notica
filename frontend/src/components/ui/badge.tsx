import * as React from 'react'
import { cn } from '@/lib/utils'

type Status = 'success' | 'failure' | 'warning' | 'skipped' | 'missed'

const statusStyles: Record<Status, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success)]',
  failure: 'bg-[var(--failure-bg)] text-[var(--failure)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning)]',
  skipped: 'bg-[var(--skipped-bg)] text-[var(--skipped)]',
  missed:  'bg-[var(--missed-bg)] text-[var(--missed)]',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: Status
}

function Badge({ className, status, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide',
        status ? statusStyles[status] : 'bg-[var(--bg-elevated)] text-[var(--text-2)]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge, type Status }
