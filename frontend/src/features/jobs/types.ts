export type JobStatus = 'success' | 'failure' | 'warning' | 'skipped'

export interface JobListItem {
  id: string
  name: string
  description: string | null
  token: string
  expected_cron: string | null
  grace_period: number
  tags: Record<string, string>
  immediate_on: string[]
  immediate_contacts: string[]
  active: boolean
  created_at: string
  updated_at: string
  last_status: JobStatus | null
  last_run_at: string | null
  is_overdue: boolean
  recent_statuses: string[]
}

export type JobResponse = JobListItem

export interface JobCreate {
  name: string
  description?: string | null
  expected_cron?: string | null
  grace_period?: number
  tags?: Record<string, string>
  immediate_on?: string[]
  immediate_contacts?: string[]
}

export interface JobUpdate {
  name?: string
  description?: string | null
  expected_cron?: string | null
  grace_period?: number
  tags?: Record<string, string>
  immediate_on?: string[]
  immediate_contacts?: string[]
  active?: boolean
}
