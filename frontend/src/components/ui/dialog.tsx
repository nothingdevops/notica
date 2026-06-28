import * as React from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
}

function Dialog({ open, onClose, title, description, children }: DialogProps) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-1)]">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-[var(--text-2)]">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)]"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface DialogFooterProps { children: React.ReactNode }
function DialogFooter({ children }: DialogFooterProps) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>
}

export { Dialog, DialogFooter }
