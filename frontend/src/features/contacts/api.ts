import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import type { Contact, ContactCreate, ContactUpdate } from './types'

const KEYS = {
  all:  ['contacts'] as const,
  list: () => ['contacts', 'list'] as const,
}

export function useContacts() {
  return useQuery({
    queryKey: KEYS.list(),
    queryFn:  () => api.get<Contact[]>('/contacts'),
  })
}

export function useCreateContact() {
  return useMutation({
    mutationFn: (data: ContactCreate) => api.post<Contact>('/contacts', data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useUpdateContact(id: string) {
  return useMutation({
    mutationFn: (data: ContactUpdate) => api.put<Contact>(`/contacts/${id}`, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useDeleteContact() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEYS.all }),
  })
}

export function useTestContact() {
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean; message: string }>(`/contacts/${id}/test`, {}),
  })
}
