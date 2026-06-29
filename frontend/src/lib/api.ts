import { keycloak } from '@/lib/keycloak'

const BASE = '/api/v1'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  }

  if (keycloak) {
    try {
      await keycloak.updateToken(30)
    } catch {
      keycloak.login()
      throw new ApiError(401, 'Session expired — redirecting to login')
    }
    headers['Authorization'] = `Bearer ${keycloak.token}`
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),

  // Multipart file upload — no Content-Type header so browser sets it with boundary
  upload: async (path: string, body: FormData): Promise<void> => {
    const headers: Record<string, string> = {}
    if (keycloak) {
      try { await keycloak.updateToken(30) } catch { keycloak.login(); throw new ApiError(401, 'Session expired') }
      headers['Authorization'] = `Bearer ${keycloak.token}`
    }
    const res = await fetch(`${BASE}${path}`, { method: 'POST', body, headers })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new ApiError(res.status, text)
    }
  },
}

export { ApiError }
