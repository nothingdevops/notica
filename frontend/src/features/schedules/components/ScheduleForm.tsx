import { useState, useMemo } from 'react'
import cronstrue from 'cronstrue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useContacts } from '@/features/contacts/api'
import { getDisplayTimezone, getUtcOffsetLabel } from '@/lib/utils'
import type { Schedule, ScheduleCreate } from '../types'

function parseCronSafe(expr: string): string {
  try {
    return cronstrue.toString(expr)
  } catch {
    return 'Invalid cron expression'
  }
}

function isCronValid(expr: string): boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  try {
    cronstrue.toString(expr)
    return true
  } catch {
    return false
  }
}

interface ScheduleFormProps {
  initial?: Schedule
  onSubmit: (data: ScheduleCreate) => void
  onCancel: () => void
  isPending: boolean
}

export function ScheduleForm({ initial, onSubmit, onCancel, isPending }: ScheduleFormProps) {
  const { data: contacts = [] } = useContacts()

  const [name,     setName]     = useState(initial?.name ?? '')
  const [cronExpr, setCronExpr] = useState(initial?.cron_expr ?? '0 8 * * *')
  const [selected, setSelected] = useState<string[]>(initial?.contacts ?? [])

  const cronPreview = useMemo(() => parseCronSafe(cronExpr), [cronExpr])
  const cronOk      = useMemo(() => isCronValid(cronExpr), [cronExpr])
  const tzLabel     = getUtcOffsetLabel(getDisplayTimezone())

  function toggleContact(id: string) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id],
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cronOk) return
    onSubmit({ name, cron_expr: cronExpr.trim(), contacts: selected })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Name</span>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Daily Report"
          required
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Cron expression</span>
        <Input
          value={cronExpr}
          onChange={e => setCronExpr(e.target.value)}
          placeholder="0 8 * * *"
          className="font-mono"
          required
        />
        <span
          className="text-[11px]"
          style={{ color: cronOk ? 'var(--text-3)' : 'var(--failure)' }}
        >
          {cronPreview}{cronOk && tzLabel ? ` (${tzLabel})` : ''}
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {[
            { label: 'Daily 8am',   value: '0 8 * * *' },
            { label: 'Daily midnight', value: '0 0 * * *' },
            { label: 'Weekly Mon',  value: '0 8 * * 1' },
            { label: 'Hourly',      value: '0 * * * *' },
          ].map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => setCronExpr(p.value)}
              className="rounded border border-[var(--border)] px-2 py-0.5 font-mono text-[9px] text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-2)]">Send to contacts</span>
        {contacts.length === 0 ? (
          <p className="text-[11px] text-[var(--text-3)]">
            No contacts yet.{' '}
            <a href="/contacts" className="text-[var(--accent)] hover:underline underline-offset-2">
              Add one first.
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {contacts.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleContact(c.id)}
                className={
                  selected.includes(c.id)
                    ? 'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:border-[var(--text-3)]'
                }
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={isPending || !cronOk || !name.trim()}>
          {isPending ? 'Saving…' : initial ? 'Save changes' : 'Add schedule'}
        </Button>
      </div>
    </form>
  )
}
