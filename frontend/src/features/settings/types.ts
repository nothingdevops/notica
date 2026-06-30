export interface Settings {
  retention_days: number
  app_url: string
  display_timezone: string
  organization_name: string
  has_logo: boolean
  has_favicon: boolean
  overdue_scan_interval: number
}

export interface SettingsUpdate {
  retention_days?: number
  app_url?: string
  display_timezone?: string
  organization_name?: string
  overdue_scan_interval?: number
}
