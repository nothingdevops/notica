import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { Settings, SettingsUpdate } from './types'

const KEY = ['settings'] as const

export function useSettings() {
  return useQuery<Settings>({
    queryKey: KEY,
    queryFn: () => api.get<Settings>('/settings'),
  })
}

export function useUpdateSettings() {
  return useMutation<Settings, Error, SettingsUpdate>({
    mutationFn: (data) => api.put<Settings>('/settings', data),
    onSuccess: (updated) => {
      queryClient.setQueryData(KEY, updated)
    },
  })
}
