import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useSettings } from '@/features/settings/api'
import { setDisplayTimezone } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { keycloak } from '@/lib/keycloak'

function AccessDenied() {
  const email = keycloak?.tokenParsed?.email ?? keycloak?.tokenParsed?.preferred_username ?? 'your account'
  return (
    <div className="flex h-full items-center justify-center bg-[var(--bg-base)]">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="text-4xl">🔒</span>
        <h1 className="text-base font-semibold text-[var(--text-1)]">Access Denied</h1>
        <p className="text-xs leading-relaxed text-[var(--text-3)]">
          <span className="font-mono text-[var(--text-2)]">{email}</span> does not have permission to access Notica.
          <br />Contact your administrator to get the <span className="font-mono">notica-user</span> role assigned in Keycloak.
        </p>
        <button
          onClick={() => keycloak?.logout()}
          className="mt-2 rounded px-3 py-1.5 text-xs border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text-1)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const { data: settings, error } = useSettings()

  useEffect(() => {
    if (settings?.display_timezone) {
      setDisplayTimezone(settings.display_timezone)
    }
  }, [settings?.display_timezone])

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return
    if (settings?.has_favicon) {
      link.href = '/api/v1/assets/favicon'
    } else {
      link.href = '/favicon.svg'
    }
  }, [settings?.has_favicon])

  // 403 = authenticated but missing required Keycloak role
  if (error instanceof ApiError && error.status === 403) {
    return <AccessDenied />
  }

  return (
    <div className="flex h-full overflow-hidden bg-[var(--bg-base)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
