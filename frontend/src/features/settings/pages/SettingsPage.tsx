import { useState, useEffect, useRef } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { useSettings, useUpdateSettings } from '../api'
import { queryClient } from '@/lib/queryClient'
import { api } from '@/lib/api'

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

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [faviconUploading, setFaviconUploading] = useState(false)
  const [assetTs, setAssetTs] = useState(() => Date.now())

  async function handleAssetUpload(file: File, type: 'logo' | 'favicon') {
    const setter = type === 'logo' ? setLogoUploading : setFaviconUploading
    setter(true)
    try {
      const form = new FormData()
      form.append('file', file)
      await api.upload(`/assets/${type}`, form)
      setAssetTs(Date.now())
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast(`${type === 'logo' ? 'Logo' : 'Favicon'} updated`, 'success')
    } catch {
      toast('Upload failed', 'error')
    } finally {
      setter(false)
    }
  }

  async function handleAssetDelete(type: 'logo' | 'favicon') {
    try {
      await api.delete(`/assets/${type}`)
      setAssetTs(Date.now())
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast(`${type === 'logo' ? 'Logo' : 'Favicon'} removed`, 'success')
    } catch {
      toast('Failed to remove', 'error')
    }
  }

  const [retentionDays, setRetentionDays] = useState<number>(90)
  const [appUrl, setAppUrl] = useState<string>('')
  const [displayTimezone, setDisplayTimezone] = useState<string>('Asia/Ho_Chi_Minh')
  const [orgName, setOrgName] = useState<string>('Notica')
  const [overdueInterval, setOverdueInterval] = useState<number>(1)
  const [initialRetention, setInitialRetention] = useState<number>(90)
  const [initialAppUrl, setInitialAppUrl] = useState<string>('')
  const [initialTimezone, setInitialTimezone] = useState<string>('Asia/Ho_Chi_Minh')
  const [initialOrgName, setInitialOrgName] = useState<string>('Notica')
  const [initialOverdueInterval, setInitialOverdueInterval] = useState<number>(1)

  useEffect(() => {
    if (settings) {
      setRetentionDays(settings.retention_days)
      setAppUrl(settings.app_url)
      setDisplayTimezone(settings.display_timezone)
      setOrgName(settings.organization_name)
      setOverdueInterval(settings.overdue_scan_interval)
      setInitialRetention(settings.retention_days)
      setInitialAppUrl(settings.app_url)
      setInitialTimezone(settings.display_timezone)
      setInitialOrgName(settings.organization_name)
      setInitialOverdueInterval(settings.overdue_scan_interval)
    }
  }, [settings])

  const isDirty = retentionDays !== initialRetention || appUrl !== initialAppUrl || displayTimezone !== initialTimezone || orgName !== initialOrgName || overdueInterval !== initialOverdueInterval
  const retentionValid = retentionDays >= 1 && retentionDays <= 3650
  const urlValid = appUrl.startsWith('http://') || appUrl.startsWith('https://')
  const canSave = isDirty && retentionValid && urlValid

  function handleSave() {
    const update: Parameters<typeof updateSettings.mutate>[0] = {}
    if (retentionDays !== initialRetention) update.retention_days = retentionDays
    if (appUrl !== initialAppUrl) update.app_url = appUrl
    if (displayTimezone !== initialTimezone) update.display_timezone = displayTimezone
    if (orgName !== initialOrgName) update.organization_name = orgName
    if (overdueInterval !== initialOverdueInterval) update.overdue_scan_interval = overdueInterval
    updateSettings.mutate(update, {
      onSuccess: () => {
        setInitialRetention(retentionDays)
        setInitialAppUrl(appUrl)
        setInitialTimezone(displayTimezone)
        setInitialOrgName(orgName)
        setInitialOverdueInterval(overdueInterval)
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
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Branding
            </h2>
            <p className="mb-4 text-[11px] text-[var(--text-3)]">
              Customize the appearance of your Notica instance.
            </p>

            <div className="flex flex-col gap-5">
              {/* Organization name */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[var(--text-2)]">Organization name</span>
                <Input
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Notica"
                  className="w-64"
                />
                <span className="text-[11px] text-[var(--text-3)]">
                  Shown as sender name in Teams digest cards.
                </span>
              </label>

              {/* Logo */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--text-2)]">App logo</span>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)]">
                    {settings?.has_logo ? (
                      <img src={`/api/v1/assets/logo?t=${assetTs}`} alt="logo" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <span className="text-base">⚡</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleAssetUpload(f, 'logo')
                        e.target.value = ''
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? 'Uploading…' : settings?.has_logo ? 'Replace logo' : 'Upload logo'}
                    </Button>
                    {settings?.has_logo && (
                      <button
                        onClick={() => handleAssetDelete('logo')}
                        className="text-[11px] text-[var(--failure)] hover:underline text-left"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-3)]">PNG, JPG, or SVG · max 500 KB · Replaces the ⚡ icon in the sidebar.</span>
              </div>

              {/* Favicon */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--text-2)]">Favicon</span>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]">
                    {settings?.has_favicon ? (
                      <img src={`/api/v1/assets/favicon?t=${assetTs}`} alt="favicon" className="h-5 w-5 object-contain" />
                    ) : (
                      <span className="text-[9px] text-[var(--text-3)]">none</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/png,image/x-icon,image/svg+xml"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) handleAssetUpload(f, 'favicon')
                        e.target.value = ''
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={faviconUploading}
                    >
                      {faviconUploading ? 'Uploading…' : settings?.has_favicon ? 'Replace favicon' : 'Upload favicon'}
                    </Button>
                    {settings?.has_favicon && (
                      <button
                        onClick={() => handleAssetDelete('favicon')}
                        className="text-[11px] text-[var(--failure)] hover:underline text-left"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-3)]">PNG, ICO, or SVG · max 50 KB · Shown as browser tab icon.</span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
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
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
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
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Operations
            </h2>
            <p className="mb-4 text-[11px] text-[var(--text-3)]">
              Configure operational parameters for job monitoring and health checks.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-2)]">Overdue scan interval (phút)</span>
              <Input
                type="number"
                min={1}
                max={60}
                value={overdueInterval}
                onChange={e => setOverdueInterval(Number(e.target.value))}
                className="w-28"
              />
              <span className="text-[11px] text-[var(--text-3)]">
                Tần suất kiểm tra job overdue. Mặc định 1 phút. Thay đổi có hiệu lực ngay.
              </span>
            </label>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
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
                  setOrgName(initialOrgName)
                  setOverdueInterval(initialOverdueInterval)
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
