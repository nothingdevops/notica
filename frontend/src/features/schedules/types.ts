export interface Schedule {
  id: string
  name: string
  cron_expr: string
  contacts: string[]
  active: boolean
  created_at: string
  last_fired_at: string | null
  last_status: 'success' | 'failure' | null
}

export interface ScheduleCreate {
  name: string
  cron_expr: string
  contacts?: string[]
  active?: boolean
}

export interface ScheduleUpdate {
  name?: string
  cron_expr?: string
  contacts?: string[]
  active?: boolean
}
