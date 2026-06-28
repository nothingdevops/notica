export type AlertStatus = 'success' | 'failure' | 'warning' | 'skipped'

export interface AlertListItem {
  id: string
  job_id: string
  job_name: string
  status: AlertStatus
  completion_time: string
  duration_sec: number | null
  description: string | null
  tags: Record<string, string>
  received_at: string
}

export interface AlertResponse extends AlertListItem {
  log_content: string | null
}

export interface AlertFilters {
  job_id?: string
  status?: string[]
  date_from?: string
  date_to?: string
  page?: number
  size?: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
}
