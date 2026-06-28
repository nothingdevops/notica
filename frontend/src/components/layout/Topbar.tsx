import { ThemeToggle } from '@/components/theme/ThemeToggle'

interface TopbarProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-card)] px-5">
      <div>
        <h1 className="text-[14px] font-semibold text-[var(--text-1)]">{title}</h1>
        {subtitle && (
          <p className="font-mono text-[10px] text-[var(--text-3)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  )
}
