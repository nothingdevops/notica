import { useState, useEffect } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useSettings, useUpdateSettings } from '../api'

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Ho_Chi_Minh', label: 'UTC+07 — Asia/Ho_Chi_Minh (Vietnam)' },
  { value: 'Asia/Bangkok',     label: 'UTC+07 — Asia/Bangkok (Thailand)' },
  { value: 'Asia/Jakarta',     label: 'UTC+07 — Asia/Jakarta (Indonesia WIB)' },
  { value: 'Asia/Singapore',   label: 'UTC+08 — Asia/Singapore' },
  { value: 'Asia/Kuala_Lumpur',label: 'UTC+08 — Asia/Kuala_Lumpur (Malaysia)' },
  { value: 'Asia/Shanghai',    label: 'UTC+08 — Asia/Shanghai (China)' },
  { value: 'Asia/Taipei',      label: 'UTC+08 — Asia/Taipei (Taiwan)' },
  { value: 'Asia/Seoul',       label: 'UTC+09 — Asia/Seoul (Korea)' },
  { value: 'Asia/Tokyo',       label: 'UTC+09 — Asia/Tokyo (Japan)' },
  { value: 'Asia/Kolkata',     label: 'UTC+05:30 — Asia/Kolkata (India)' },
  { value: 'Europe/London',    label: 'UTC+00/+01 — Europe/London' },
  { value: 'Europe/Berlin',    label: 'UTC+01/+02 — Europe/Berlin' },
  { value: 'America/New_York', label: 'UTC−05/−04 — America/New_York' },
  { value: 'America/Los_Angeles', label: 'UTC−08/−07 — America/Los_Angeles' },
  { value: 'UTC',              label: 'UTC+00 — UTC' },
]

export function SettingsPage() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const { toast } = useToast()

  const [retentionDays, setRetentionDays] = useState<number>(90)
  const [appUrl, setAppUrl] = useState<string>('')
  const [displayTimezone, setDisplayTimezone] = useState<string>('Asia/Ho_Chi_Minh')
  const [initialRetention, setInitialRetention] = useState<number>(90)
  const [initialAppUrl, setInitialAppUrl] = useState<string>('')
  const [initialTimezone, setInitialTimezone] = useState<string>('Asia/Ho_Chi_Minh')

  useEffect(() => {
    if (settings) {
      setRetentionDays(settings.retention_days)
      setAppUrl(settings.app_url)
      setDisplayTimezone(settings.display_timezone)
      setInitialRetention(settings.retention_days)
      setInitialAppUrl(settings.app_url)
      setInitialTimezone(settings.display_timezone)
    }
  }, [settings])

  const isDirty = retentionDays !== initialRetention || appUrl !== initialAppUrl || displayTimezone !== initialTimezone
  const retentionValid = retentionDays >= 1 && retentionDays <= 3650
  const urlValid = appUrl.startsWith('http://') || appUrl.startsWith('https://')
  const canSave = isDirty && retentionValid && urlValid

  function handleSave() {
    const update: Parameters<typeof updateSettings.mutate>[0] = {}
    if (retentionDays !== initialRetention) update.retention_days = retentionDays
    if (appUrl !== initialAppUrl) update.app_url = appUrl
    if (displayTimezone !== initialTimezone) update.display_timezone = displayTimezone
    updateSettings.mutate(update, {
      onSuccess: () => {
        setInitialRetention(retentionDays)
        setInitialAppUrl(appUrl)
        setInitialTimezone(displayTimezone)
        toast('Settings saved', 'success')
      },
      onError: () => toast('Failed to save settings', 'error'),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title="Settings" />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-[var(--text-3)]">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar title="Settings" />
      <div className="flex-1 overflow-auto p-5">
        <div className="flex max-w-2xl flex-col gap-5">

          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Display
            </h2>
            <p className="mb-4 text-[11px] text-[var(--text-3)]">
              Timezone used for all timestamps on the dashboard and in Teams notification cards.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-2)]">Timezone</span>
              <select
                value={displayTimezone}
                onChange={e => setDisplayTimezone(e.target.value)}
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {TIMEZONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                {!TIMEZONE_OPTIONS.find(o => o.value === displayTimezone) && (
                  <option value={displayTimezone}>{displayTimezone}</option>
                )}
              </select>
              <span className="text-[11px] text-[var(--text-3)]">
                Affects UI display and Teams card timestamps. UTC values in the database are unchanged.
              </span>
            </label>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Data Retention
            </h2>
            <p className="mb-4 text-[11px] text-[var(--text-3)]">
              Alerts older than this are purged nightly at 2:00 AM UTC.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-2)]">Keep alerts for (days)</span>
              <Input
                type="number"
                min={1}
                max={3650}
                value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value))}
                className="w-32"
              />
              {!retentionValid && (
                <span className="text-[11px]" style={{ color: 'var(--failure)' }}>
                  Must be between 1 and 3650
                </span>
              )}
            </label>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)]">
              Application
            </h2>
            <p className="mb-4 text-[11px] text-[var(--text-3)]">
              Used as base URL for "View log →" links in digest cards.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-2)]">App URL</span>
              <Input
                value={appUrl}
                onChange={e => setAppUrl(e.target.value)}
                placeholder="http://192.168.1.10"
              />
              {appUrl && !urlValid && (
                <span className="text-[11px]" style={{ color: 'var(--failure)' }}>
                  Must start with http:// or https://
                </span>
              )}
            </label>
          </section>

          {isDirty && (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRetentionDays(initialRetention)
                  setAppUrl(initialAppUrl)
                  setDisplayTimezone(initialTimezone)
                }}
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!canSave || updateSettings.isPending}
              >
                {updateSettings.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
