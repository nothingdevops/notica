export interface Contact {
  id: string
  name: string
  type: 'teams'
  config: { webhook_url: string }
  active: boolean
  created_at: string
}

export interface ContactCreate {
  name: string
  type: 'teams'
  config: { webhook_url: string }
  active?: boolean
}

export interface ContactUpdate {
  name?: string
  config?: { webhook_url: string }
  active?: boolean
}
