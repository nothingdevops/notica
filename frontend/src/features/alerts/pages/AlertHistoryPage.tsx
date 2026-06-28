import { useState, useEffect } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { AlertFilters } from '../components/AlertFilters'
import { AlertTable } from '../components/AlertTable'
import { LogDrawer } from '../components/LogDrawer'
import { useAlerts } from '../api'
import type { AlertFilters as AlertFiltersType } from '../types'

const DEFAULT_SIZE = 50

function filtersFromParams(params: URLSearchParams): AlertFiltersType {
  const status = params.get('status')
  return {
    job_id:    params.get('job_id')    ?? undefined,
    status:    status ? status.split(',').filter(Boolean) : undefined,
    date_from: params.get('date_from') ?? undefined,
    date_to:   params.get('date_to')   ?? undefined,
    page:      params.get('page')      ? Number(params.get('page')) : 1,
    size:      DEFAULT_SIZE,
  }
}

function paramsFromFilters(f: AlertFiltersType): Record<string, string> {
  const p: Record<string, string> = {}
  if (f.job_id)            p.job_id    = f.job_id
  if (f.status?.length)    p.status    = f.status.join(',')
  if (f.date_from)         p.date_from = f.date_from
  if (f.date_to)           p.date_to   = f.date_to
  if (f.page && f.page > 1) p.page     = String(f.page)
  return p
}

export function AlertHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { alertId: routeAlertId } = useParams<{ alertId?: string }>()
  const navigate = useNavigate()

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(routeAlertId ?? null)

  // Sync drawer with route param on navigation
  useEffect(() => {
    setSelectedAlertId(routeAlertId ?? null)
  }, [routeAlertId])

  const filters = filtersFromParams(searchParams)

  function updateFilters(partial: Partial<AlertFiltersType>) {
    const next = { ...filters, ...partial }
    setSearchParams(paramsFromFilters(next), { replace: true })
  }

  function clearFilters() {
    setSearchParams({}, { replace: true })
  }

  function handleDrawerClose() {
    setSelectedAlertId(null)
    // If we navigated here via /alerts/:id, go back to /alerts
    if (routeAlertId) navigate('/alerts', { replace: true })
  }

  const { data, isLoading } = useAlerts(filters)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Alert History"
        subtitle={data ? `${data.total} alerts` : undefined}
      />
      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-col gap-4">
          <AlertFilters
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
          />
          <AlertTable
            data={data?.items ?? []}
            total={data?.total ?? 0}
            page={filters.page ?? 1}
            pageSize={filters.size ?? DEFAULT_SIZE}
            isLoading={isLoading}
            onPageChange={p => updateFilters({ page: p })}
            onRowClick={id => setSelectedAlertId(id)}
          />
        </div>
      </div>

      <LogDrawer
        alertId={selectedAlertId}
        onClose={handleDrawerClose}
      />
    </div>
  )
}
