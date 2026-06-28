import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Bell, Clock, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { api } from '@/lib/api'
import type { JobListItem } from '@/features/jobs/types'
import { keycloak } from '@/lib/keycloak'

const navItems = [
  { to: '/',          label: 'Job Board',      icon: LayoutDashboard, end: true },
  { to: '/alerts',    label: 'Alert History',  icon: Bell },
  { to: '/schedules', label: 'Schedules',      icon: Clock },
  { to: '/contacts',  label: 'Contacts',       icon: Users },
]

export function Sidebar() {
  const { data: jobs = [] } = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn:  () => api.get<JobListItem[]>('/jobs'),
    refetchInterval: 30_000,
  })

  const failureCount = jobs.filter(j => j.last_status === 'failure').length

  return (
    <aside className="flex w-[188px] min-w-[188px] flex-col border-r border-[var(--border)] bg-[var(--bg-card)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-[var(--border-sub)] px-4 py-3.5">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] text-sm">
          ⚡
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[var(--text-1)]">Notica</div>
          <div className="font-mono text-[9px] text-[var(--text-3)]">v0.1.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-px py-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 border-l-2 px-4 py-[7px] text-[12px] font-medium transition-colors',
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--text-1)]'
                  : 'border-transparent text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]',
              )
            }
          >
            <Icon size={13} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {label === 'Job Board' && failureCount > 0 && (
              <span className="rounded bg-[var(--failure-bg)] px-1.5 py-px font-mono text-[9px] font-semibold text-[var(--failure)]">
                {failureCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border-sub)]">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 border-l-2 px-4 py-[7px] text-[12px] font-medium transition-colors',
              isActive
                ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--text-1)]'
                : 'border-transparent text-[var(--text-2)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-1)]',
            )
          }
        >
          <Settings size={13} className="shrink-0" />
          <span>Settings</span>
        </NavLink>

        {keycloak && (
          <div className="flex items-center justify-between border-t border-[var(--border-sub)] px-4 py-2">
            <span className="max-w-[100px] truncate font-mono text-[10px] text-[var(--text-3)]">
              {keycloak.tokenParsed?.preferred_username ?? ''}
            </span>
            <button
              onClick={() => keycloak!.logout()}
              className="text-[10px] text-[var(--text-3)] transition-colors hover:text-[var(--failure)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
