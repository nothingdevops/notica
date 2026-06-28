export const queryKeys = {
  jobs: {
    all:    ['jobs'] as const,
    list:   () => [...queryKeys.jobs.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.jobs.all, id] as const,
  },
  alerts: {
    all:    ['alerts'] as const,
    list:   (filters: object) => [...queryKeys.alerts.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.alerts.all, id] as const,
  },
}
