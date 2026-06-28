import { Badge, type Status } from '@/components/ui/badge'

const LABELS: Record<string, string> = {
  success: 'success',
  failure: 'failure',
  warning: 'warning',
  skipped: 'skipped',
}

interface StatusPillProps {
  status: string
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <Badge status={status as Status}>
      {LABELS[status] ?? status}
    </Badge>
  )
}
