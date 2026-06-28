import * as React from 'react'
import { cn } from '@/lib/utils'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
}

const ToastContext = React.createContext<{
  toast: (message: string, type?: ToastType) => void
}>({ toast: () => {} })

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const toast = React.useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-2.5 rounded-lg border px-4 py-3 text-xs shadow-lg backdrop-blur',
              t.type === 'success' && 'border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]',
              t.type === 'error'   && 'border-[var(--failure)] bg-[var(--failure-bg)] text-[var(--failure)]',
              t.type === 'info'    && 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-1)]',
            )}
          >
            {t.type === 'success' && <CheckCircle size={13} />}
            {t.type === 'error'   && <AlertCircle size={13} />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-1 opacity-60 hover:opacity-100">
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return React.useContext(ToastContext)
}
