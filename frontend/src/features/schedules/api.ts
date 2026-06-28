import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { Schedule, ScheduleCreate, ScheduleUpdate } from './types'

const KEYS = {
  all:  ['schedules'] as const,
  list: () => ['schedules', 'list'] as const,
}

export function useSchedules() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn:  () => api.get<Schedule[]>('/schedules'),
  })
}

export function useCreateSchedule() {
  return useMutation({
    mutationFn: (data: ScheduleCreate) => api.post<Schedule>('/schedules', data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateSchedule(id: string) {
  return useMutation({
    mutationFn: (data: ScheduleUpdate) => api.put<Schedule>(`/schedules/${id}`, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useDeleteSchedule() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/schedules/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useRunNow() {
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: boolean; fired_at: string }>(`/schedules/${id}/run-now`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}
