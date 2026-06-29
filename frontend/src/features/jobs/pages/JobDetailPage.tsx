import { useState, useMemo } from 'react'
import cronstrue from 'cronstrue'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useContacts } from '@/features/contacts/api'
import { JobStatsPanel } from '@/features/analytics/components/JobStatsPanel'
import { useJob, useUpdateJob, useRegenerateToken } from '../api'
import type { JobUpdate } from '../types'

const IMMEDIATE_OPTIONS = [
  { value: 'failure', label: 'failure' },
  { value: 'warning', label: 'warning' },
  { value: 'success', label: 'success' },
  { value: 'skipped', label: 'skipped' },
]

const ENV_OPTIONS = ['prod', 'dev', 'dr', 'other'] as const
const SERVICE_OPTIONS = ['db', 'app', 'service', 'other'] as const

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { data: job, isLoading } = useJob(id!)
  const { data: contacts = [] } = useContacts()
  const updateJob = useUpdateJob(id!)
  const regenerateToken = useRegenerateToken(id!)

  const [showToken, setShowToken] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)

  const [form, setForm] = useState<Partial<JobUpdate>>({})

  const currentName         = form.name         ?? job?.name         ?? ''
  const currentDescription  = form.description  ?? job?.description  ?? ''
  const currentCron         = form.expected_cron ?? job?.expected_cron ?? ''
  const currentGrace        = form.grace_period  ?? job?.grace_period  ?? 30
  const currentImmediateOn  = form.immediate_on  ?? job?.immediate_on  ?? []
  const currentEnv          = (form.tags?.env     ?? job?.tags?.env     ?? null) as string | null
  const currentService      = (form.tags?.service ?? job?.tags?.service ?? null) as string | null

  function handleSave() {
    if (!job) return
    updateJob.mutate(form, {
      onSuccess: () => { toast('Job updated', 'success'); setForm({}) },
      onError:   () => toast('Failed to save', 'error'),
    })
  }

  function handleRegenerate() {
    regenerateToken.mutate(undefined, {
      onSuccess: () => { setConfirmRegen(false); toast('Token regenerated', 'success') },
      onError:   () => toast('Failed to regenerate token', 'error'),
    })
  }

  function copyToken() {
    const token = job?.token
    if (!token) return
    void navigator.clipboard.writeText(token).then(() => toast('Token copied', 'success'))
  }

  function toggleEnv(opt: string) {
    const next = currentEnv === opt ? null : opt
    const newTags = { ...(form.tags ?? job?.tags ?? {}) }
    if (next) newTags.env = next
    else delete newTags.env
    setForm(f => ({ ...f, tags: newTags }))
  }

  function toggleService(opt: string) {
    const next = currentService === opt ? null : opt
    const newTags = { ...(form.tags ?? job?.tags ?? {}) }
    if (next) newTags.service = next
    else delete newTags.service
    setForm(f => ({ ...f, tags: newTags }))
  }

  function toggleImmediateOn(value: string) {
    const current = currentImmediateOn
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    setForm(f => ({ ...f, immediate_on: next }))
  }

  const isDirty = Object.keys(form).length > 0

  const cronPreview = useMemo(() => {
    if (!currentCron.trim()) return ''
    try { return cronstrue.toString(currentCron) } catch { return 'Invalid cron expression' }
  }, [currentCron])
  const cronOk = useMemo(() => {
    if (!currentCron.trim()) return true
    try { cronstrue.toString(currentCron); return true } catch { return false }
  }, [currentCron])

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Job Detail" />
        <div className="flex-1 overflow-auto p-5">
          <div className="flex max-w-2xl flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!job) return null

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          title={job.name}
          subtitle="Job configuration"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={12} />
              Back
            </Button>
          }
        />

        <div className="flex-1 overflow-auto p-5">
          <div className="flex max-w-2xl flex-col gap-5">

            {/* Section 1 — Job Info */}
            <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Job Info
              </h2>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-2)]">Name</span>
                  <Input
                    value={currentName}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-2)]">Description</span>
                  <Input
                    value={currentDescription}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-[var(--text-2)]">Environment</span>
                  <div className="flex flex-wrap gap-2">
                    {ENV_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleEnv(opt)}
                        className="rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors"
                        style={
                          currentEnv === opt
                            ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)' }
                            : { borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)' }
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-[var(--text-2)]">Service type</span>
                  <div className="flex flex-wrap gap-2">
                    {SERVICE_OPTIONS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleService(opt)}
                        className="rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors"
                        style={
                          currentService === opt
                            ? { borderColor: 'var(--accent)', background: 'var(--accent-bg)', color: 'var(--accent)' }
                            : { borderColor: 'var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)' }
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <label className="flex flex-1 flex-col gap-1">
                    <span className="text-xs text-[var(--text-2)]">Expected cron</span>
                    <Input
                      value={currentCron}
                      onChange={e => setForm(f => ({ ...f, expected_cron: e.target.value }))}
                      placeholder="0 3 * * *"
                      className="font-mono"
                    />
                    {currentCron && (
                      <span
                        className="text-[11px]"
                        style={{ color: cronOk ? 'var(--text-3)' : 'var(--failure)' }}
                      >
                        {cronPreview}
                      </span>
                    )}
                  </label>
                  <label className="flex w-28 flex-col gap-1">
                    <span className="text-xs text-[var(--text-2)]">Grace period (min)</span>
                    <Input
                      type="number"
                      value={currentGrace}
                      onChange={e => setForm(f => ({ ...f, grace_period: Number(e.target.value) }))}
                      min={0}
                    />
                  </label>
                </div>
              </div>
            </section>

            {/* Section 2 — Token */}
            <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Alert Token
              </h2>
              <p className="mb-4 text-[11px] text-[var(--text-3)]">
                Send this as the <code className="font-mono">X-Job-Token</code> header when posting alerts.
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[11px] text-[var(--text-2)]"
                  style={{ filter: showToken ? 'none' : 'blur(4px)', userSelect: showToken ? 'text' : 'none' }}
                >
                  {job.token}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowToken(s => !s)} title={showToken ? 'Hide' : 'Show'}>
                  {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
                <Button variant="ghost" size="icon" onClick={copyToken} title="Copy token">
                  <Copy size={13} />
                </Button>
              </div>
              <div className="mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmRegen(true)}
                >
                  <RefreshCw size={11} />
                  Regenerate Token
                </Button>
              </div>
            </section>

            {/* Section 3 — Immediate Alerts */}
            <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
                Immediate Alerts
              </h2>
              <p className="mb-4 text-[11px] text-[var(--text-3)]">
                Alert fires immediately when job reports these statuses.
              </p>
              <div className="flex flex-wrap gap-2">
                {IMMEDIATE_OPTIONS.map(opt => {
                  const active = currentImmediateOn.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleImmediateOn(opt.value)}
                      className={
                        active
                          ? 'rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-colors border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                          : 'rounded-md border px-3 py-1.5 font-mono text-xs font-medium transition-colors border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:border-[var(--text-3)] hover:text-[var(--text-1)]'
                      }
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {/* Contacts multi-select */}
              <div className="mt-4">
                <p className="mb-2 text-xs text-[var(--text-2)]">Notify contacts</p>
                {contacts.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-3)]">
                    No contacts configured.{' '}
                    <a href="/contacts" className="text-[var(--accent)] underline-offset-2 hover:underline">
                      Add a contact
                    </a>{' '}
                    first.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {contacts.map(c => {
                      const selected = (form.immediate_contacts ?? job?.immediate_contacts ?? [])
                        .includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const current = form.immediate_contacts ?? job?.immediate_contacts ?? []
                            const next = selected
                              ? current.filter(id => id !== c.id)
                              : [...current, c.id]
                            setForm(f => ({ ...f, immediate_contacts: next }))
                          }}
                          className={
                            selected
                              ? 'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)]'
                              : 'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-2)] hover:border-[var(--text-3)] hover:text-[var(--text-1)]'
                          }
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Section 4 — Health Analytics */}
            <JobStatsPanel jobId={id!} />

            {/* Save */}
            {isDirty && (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setForm({})}>
                  Discard
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateJob.isPending || !cronOk}
                >
                  {updateJob.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Regenerate confirm dialog */}
      <Dialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        title="Regenerate token?"
        description="This will immediately invalidate the current token. Any scripts using the old token will fail until updated."
      >
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setConfirmRegen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerateToken.isPending}
          >
            {regenerateToken.isPending ? 'Regenerating…' : 'Regenerate'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
