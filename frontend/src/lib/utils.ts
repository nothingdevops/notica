import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Runtime timezone — updated from settings API after load. Default Asia/Ho_Chi_Minh.
let _displayTz = 'Asia/Ho_Chi_Minh'

export function setDisplayTimezone(tz: string) {
  _displayTz = tz
}

export function getDisplayTimezone(): string {
  return _displayTz
}

export function formatTime(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sv-SE', {
    timeZone: _displayTz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    ...opts,
  }).replace('T', ' ')
}

export function formatTimeShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('sv-SE', {
    timeZone: _displayTz,
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).replace('T', ' ')
}

export function formatDuration(sec: number | null): string {
  if (sec === null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
