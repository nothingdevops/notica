import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { AlertFilters, AlertListItem, AlertResponse, PaginatedResponse } from './types'

export function useAlerts(filters: AlertFilters) {
  return useQuery({
    queryKey: queryKeys.alerts.list(filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.job_id)    params.set('job_id', filters.job_id)
      if (filters.status?.length) filters.status.forEach(s => params.append('status', s))
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to)   params.set('date_to', filters.date_to)
      params.set('page', String(filters.page ?? 1))
      params.set('size', String(filters.size ?? 50))
      return api.get<PaginatedResponse<AlertListItem>>(`/alerts?${params.toString()}`)
    },
  })
}

export function useAlert(id: string | null) {
  return useQuery({
    queryKey: queryKeys.alerts.detail(id ?? ''),
    queryFn:  () => api.get<AlertResponse>(`/alerts/${id}`),
    enabled:  !!id,
  })
}
