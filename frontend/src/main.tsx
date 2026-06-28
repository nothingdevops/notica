import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ToastProvider } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { router } from './router'
import { fetchSsoConfig, initKeycloak } from '@/lib/keycloak'
import './index.css'

function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

async function bootstrap() {
  let config
  try {
    config = await fetchSsoConfig()
  } catch (err) {
    console.error('Failed to fetch SSO config:', err)
    document.getElementById('root')!.innerHTML =
      '<div style="padding:2rem;font-family:monospace">Cannot reach backend. Make sure the backend is running.</div>'
    return
  }

  if (config.enabled) {
    try {
      const kc = initKeycloak(config)
      const authenticated = await kc.init({ onLoad: 'login-required', pkceMethod: 'S256' })
      if (!authenticated) {
        document.getElementById('root')!.innerHTML =
          '<div style="padding:2rem;font-family:monospace">Authentication failed. <a href="/" style="color:#818cf8">Retry</a></div>'
        return
      }
    } catch (err) {
      console.error('Keycloak init failed:', err)
      document.getElementById('root')!.innerHTML =
        `<div style="padding:2rem;font-family:monospace">Keycloak connection failed (${config.keycloak_url}).<br>Check KEYCLOAK_URL, realm, and redirect URIs.</div>`
      return
    }
  }

  renderApp()
}

bootstrap()
