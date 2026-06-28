import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
          fontFamily: 'monospace',
          background: '#0f1117',
          color: '#e5e7eb',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '1.25rem', color: '#f87171' }}>Something went wrong</div>
          <pre style={{
            maxWidth: '600px',
            overflow: 'auto',
            background: '#1f2937',
            padding: '1rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            color: '#9ca3af',
          }}>
            {this.state.error.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
