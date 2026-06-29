import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import type { JobStatsResponse, OverviewResponse, Period } from './types'

export function useOverview(period: Period = 7) {
  return useQuery({
    queryKey: queryKeys.analytics.overview(period),
    queryFn:  () => api.get<OverviewResponse>(`/analytics/overview?period=${period}`),
    staleTime: 60_000,
  })
}

export function useJobStats(jobId: string, period: Period) {
  return useQuery({
    queryKey: queryKeys.analytics.job(jobId, period),
    queryFn:  () => api.get<JobStatsResponse>(`/analytics/jobs/${jobId}?period=${period}`),
    staleTime: 60_000,
    enabled:  !!jobId,
  })
}
