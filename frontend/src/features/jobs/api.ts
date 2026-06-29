import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import type { JobListItem, JobResponse, JobCreate, JobUpdate } from './types'

export function useJobs() {
  return useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn:  () => api.get<JobListItem[]>('/jobs'),
    refetchInterval: 30_000,
  })
}

export function useJob(id: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn:  () => api.get<JobResponse>(`/jobs/${id}`),
  })
}

export function useCreateJob() {
  return useMutation({
    mutationFn: (data: JobCreate) => api.post<JobResponse>('/jobs', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}

export function useUpdateJob(id: string) {
  return useMutation({
    mutationFn: (data: JobUpdate) => api.put<JobResponse>(`/jobs/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}

export function useRegenerateToken(id: string) {
  return useMutation({
    mutationFn: () => api.post<{ token: string }>(`/jobs/${id}/regenerate-token`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) })
    },
  })
}

export function useDeleteJob(id: string) {
  return useMutation({
    mutationFn: () => api.delete(`/jobs/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all })
    },
  })
}
