export interface Settings {
  retention_days: number
  app_url: string
  display_timezone: string
}

export interface SettingsUpdate {
  retention_days?: number
  app_url?: string
  display_timezone?: string
}
