import Keycloak from 'keycloak-js'

export interface SsoConfig {
  enabled: boolean
  keycloak_url?: string
  realm?: string
  client_id?: string
}

export let keycloak: Keycloak | null = null

export async function fetchSsoConfig(): Promise<SsoConfig> {
  const res = await fetch('/api/v1/sso-config')
  if (!res.ok) throw new Error('Failed to fetch SSO config')
  return res.json()
}

export function initKeycloak(config: SsoConfig): Keycloak {
  keycloak = new Keycloak({
    url: config.keycloak_url!,
    realm: config.realm!,
    clientId: config.client_id!,
  })
  return keycloak
}
