export interface DailyStatusPoint {
  day: string          // "2026-06-28"
  success: number
  failure: number
  warning: number
  skipped: number
}

export interface DailyDurationPoint {
  day: string
  avg_duration: number | null
}

export interface TopFailingJob {
  job_name: string
  failure_count: number
}

export interface EnvHealthSparkPoint {
  day: string
  failure_rate: number
}

export interface EnvHealthItem {
  env: string
  total_jobs: number
  failing_jobs: number
  success_rate: number
  daily_spark: EnvHealthSparkPoint[]
}

export interface ProblemJobItem {
  job_id: string
  job_name: string
  env: string
  success_rate: number
  failure_count: number
  total_runs: number
  daily_status: DailyStatusPoint[]
  last_alert_at: string | null
}

export interface JobStatsResponse {
  job_id: string
  period_days: number
  success_rate: number     // 0–100
  total_runs: number
  daily_status: DailyStatusPoint[]
  daily_duration: DailyDurationPoint[]
}

export interface HealthyJobSummary {
  job_id: string
  job_name: string
  env: string
}

export interface OverviewResponse {
  total_jobs: number
  active_jobs: number
  success_rate: number
  total_alerts: number
  daily_status: DailyStatusPoint[]
  top_failing_jobs: TopFailingJob[]
  failing_jobs_count: number
  healthy_jobs_count: number
  env_health: EnvHealthItem[]
  problem_jobs: ProblemJobItem[]
  healthy_jobs: HealthyJobSummary[]
  daily_duration: DailyDurationPoint[]
}

export type Period = 7 | 30 | 90
