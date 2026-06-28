import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  width?: string
}

function Sheet({ open, onClose, title, description, children, width = '600px' }: SheetProps) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full flex-col border-l border-[var(--border)] bg-[var(--bg-card)] shadow-2xl',
        )}
        style={{ width }}
      >
        {(title || description) && (
          <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              {title && (
                <h2 className="text-sm font-semibold text-[var(--text-1)]">{title}</h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-[var(--text-3)]">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="ml-4 rounded p-1 text-[var(--text-3)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-1)]"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </>
  )
}

export { Sheet }
