import { useState, useMemo } from 'react'
import cronstrue from 'cronstrue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useContacts } from '@/features/contacts/api'
import type { JobCreate } from '../types'

const STATUSES = ['failure', 'warning', 'success', 'skipped'] as const
const ENV_OPTIONS = ['prod', 'dev', 'dr', 'other'] as const
const SERVICE_OPTIONS = ['db', 'app', 'service', 'other'] as const

function parseCronSafe(expr: string): string {
  try { return cronstrue.toString(expr) } catch { return 'Invalid cron expression' }
}
function isCronValid(expr: string): boolean {
  if (!expr.trim()) return true // optional field
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  try { cronstrue.toString(expr); return true } catch { return false }
}

interface JobFormProps {
  onSubmit: (data: JobCreate) => void
  onCancel: () => void
  isPending: boolean
}

export function JobForm({ onSubmit, onCancel, isPending }: JobFormProps) {
  const { data: contacts = [] } = useContacts()

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [expectedCron,  setExpectedCron]  = useState('')
  const [gracePeriod,   setGracePeriod]   = useState(30)
  const [immediateOn,   setImmediateOn]   = useState<string[]>([])
  const [immediateContacts, setImmediateContacts] = useState<string[]>([])
  const [selectedEnv,     setSelectedEnv]     = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)

  const cronPreview = useMemo(() => expectedCron ? parseCronSafe(expectedCron) : '', [expectedCron])
  const cronOk      = useMemo(() => isCronValid(expectedCron), [expectedCron])

  function toggleStatus(s: string) {
    setImmediateOn(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }
  function toggleContact(id: string) {
    setImmediateContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cronOk) return
    const tags: Record<string, string> = {}
    if (selectedEnv) tags.env = selectedEnv
    if (selectedService) tags.service = selectedService
    onSubmit({
      name,
      description: description || null,
      expected_cron: expectedCron.trim() || null,
      grace_period: gracePeriod,
      tags,
      immediate_on: immediateOn,
      immediate_contacts: immediateContacts,
    })
  }

  const tagBtnStyle = (active: boolean) => ({
    background: active ? 'var(--bg-elevated)' : 'transparent',
    border: `1px solid ${active ? 'var(--border-focus)' : 'var(--border)'}`,
    color: active ? 'var(--text-1)' : 'var(--text-3)',
  })

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Name <span className="text-[var(--failure)]">*</span></span>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. postgres-backup"
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Description</span>
        <Input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Short description (optional)"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Expected schedule <span className="text-[var(--text-3)]">(optional)</span></span>
        <Input
          value={expectedCron}
          onChange={e => setExpectedCron(e.target.value)}
          placeholder="0 2 * * *"
          className="font-mono"
        />
        {expectedCron && (
          <span
            className="text-[11px]"
            style={{ color: cronOk ? 'var(--text-3)' : 'var(--failure)' }}
          >
            {cronPreview}
          </span>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-[var(--text-2)]">Grace period <span className="text-[var(--text-3)]">(minutes)</span></span>
        <Input
          type="number"
          min={1}
          max={1440}
          value={gracePeriod}
          onChange={e => setGracePeriod(Number(e.target.value))}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-2)]">Environment <span className="text-[var(--text-3)]">(optional)</span></span>
        <div className="flex flex-wrap gap-2">
          {ENV_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedEnv(prev => prev === opt ? null : opt)}
              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              style={tagBtnStyle(selectedEnv === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-2)]">Service type <span className="text-[var(--text-3)]">(optional)</span></span>
        <div className="flex flex-wrap gap-2">
          {SERVICE_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedService(prev => prev === opt ? null : opt)}
              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              style={tagBtnStyle(selectedService === opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs text-[var(--text-2)]">Immediate alert on</span>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              style={tagBtnStyle(immediateOn.includes(s))}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs text-[var(--text-2)]">Immediate alert contacts</span>
          <div className="flex flex-col gap-1.5">
            {contacts.map(c => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={immediateContacts.includes(c.id)}
                  onChange={() => toggleContact(c.id)}
                  className="accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-1)]">{c.name}</span>
                <span className="text-[10px] text-[var(--text-3)]">{c.type}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || !name || !cronOk}>
          {isPending ? 'Creating…' : 'Create job'}
        </Button>
      </div>
    </form>
  )
}
