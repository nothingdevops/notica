import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Copy } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from './StatusPill'
import { useAlert } from '../api'
import { useToast } from '@/components/ui/toast'
import { formatDuration, formatTime } from '@/lib/utils'

const VIRTUAL_THRESHOLD = 500

interface LogDrawerProps {
  alertId: string | null
  onClose: () => void
}

function VirtualLog({ lines }: { lines: string[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(item => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start}px)`,
            }}
            className="px-5 py-px font-mono text-[11px] leading-[20px] text-[var(--text-2)]"
          >
            <span className="mr-4 select-none text-[var(--text-3)]">
              {String(item.index + 1).padStart(4, ' ')}
            </span>
            {lines[item.index]}
          </div>
        ))}
      </div>
    </div>
  )
}

function FlatLog({ content }: { content: string }) {
  return (
    <div className="h-full overflow-auto px-5 py-4">
      <pre
        className="font-mono text-[11px] leading-[1.7] text-[var(--text-2)]"
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
        {content}
      </pre>
    </div>
  )
}

export function LogDrawer({ alertId, onClose }: LogDrawerProps) {
  const { data: alert, isLoading } = useAlert(alertId)
  const { toast } = useToast()

  function copyLog() {
    if (!alert?.log_content) return
    void navigator.clipboard.writeText(alert.log_content).then(() =>
      toast('Log copied', 'success'),
    )
  }

  const lines = alert?.log_content?.split('\n') ?? []
  const useVirtual = lines.length > VIRTUAL_THRESHOLD

  return (
    <Sheet
      open={!!alertId}
      onClose={onClose}
      width="640px"
      title={
        alert ? (
          <span className="flex items-center gap-2">
            <span className="font-mono">{alert.job_name}</span>
            <StatusPill status={alert.status} />
          </span>
        ) : (
          'Alert Log'
        )
      }
      description={
        alert
          ? `${formatTime(alert.completion_time, { second: '2-digit' })} · ${formatDuration(alert.duration_sec)}`
          : undefined
      }
    >
      {/* Copy button */}
      {alert?.log_content && (
        <div className="flex justify-end border-b border-[var(--border)] px-5 py-2">
          <Button variant="ghost" size="sm" onClick={copyLog}>
            <Copy size={11} />
            Copy log
          </Button>
        </div>
      )}

      {/* Log content */}
      <div className="h-full overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-4" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        ) : !alert?.log_content ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-3)]">
            No log content
          </div>
        ) : useVirtual ? (
          <VirtualLog lines={lines} />
        ) : (
          <FlatLog content={alert.log_content} />
        )}
      </div>
    </Sheet>
  )
}
