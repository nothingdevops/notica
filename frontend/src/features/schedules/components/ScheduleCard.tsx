import { useState } from 'react'
import { Play, Pencil, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Sheet } from '@/components/ui/sheet'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import cronstrue from 'cronstrue'
import { useUpdateSchedule, useDeleteSchedule, useRunNow } from '../api'
import { ScheduleForm } from './ScheduleForm'
import type { Schedule, ScheduleCreate } from '../types'
import { formatTimeShort, getDisplayTimezone, getUtcOffsetLabel } from '@/lib/utils'

function parseCron(expr: string): string {
  try {
    return cronstrue.toString(expr)
  } catch {
    return expr
  }
}

const fmtDate = formatTimeShort

interface ScheduleCardProps {
  schedule: Schedule
}

export function ScheduleCard({ schedule }: ScheduleCardProps) {
  const tzLabel = getUtcOffsetLabel(getDisplayTimezone())
  const [editOpen,   setEditOpen]   = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [runState,   setRunState]   = useState<'idle' | 'pending' | 'ok' | 'err'>('idle')

  const update  = useUpdateSchedule(schedule.id)
  const remove  = useDeleteSchedule()
  const runNow  = useRunNow()

  async function handleRun() {
    setRunState('pending')
    try {
      await runNow.mutateAsync(schedule.id)
      setRunState('ok')
      setTimeout(() => setRunState('idle'), 3000)
    } catch {
      setRunState('err')
      setTimeout(() => setRunState('idle'), 3000)
    }
  }

  async function handleEdit(data: ScheduleCreate) {
    await update.mutateAsync(data)
    setEditOpen(false)
  }

  async function handleDelete() {
    await remove.mutateAsync(schedule.id)
    setDeleteOpen(false)
  }

  const statusColor = schedule.last_status === 'success' || schedule.last_status === 'forced'
    ? 'var(--success)'
    : schedule.last_status === 'failure'
    ? 'var(--failure)'
    : 'var(--text-3)'

  return (
    <>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: schedule.active ? 'var(--success)' : 'var(--text-3)' }}
                title={schedule.active ? 'Active' : 'Paused'}
              />
              <span className="font-medium text-sm text-[var(--text-1)] truncate">{schedule.name}</span>
            </div>
            <code className="text-[11px] text-[var(--text-3)] font-mono mt-0.5">{schedule.cron_expr}</code>
            <span className="text-[11px] text-[var(--text-2)]">
              {parseCron(schedule.cron_expr)}{tzLabel ? ` (${tzLabel})` : ''}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRun}
              disabled={runState === 'pending'}
              title="Run now"
              className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            >
              {runState === 'idle' || runState === 'pending' ? (
                <Play className="w-3.5 h-3.5" />
              ) : runState === 'ok' ? (
                <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" style={{ color: 'var(--failure)' }} />
              )}
            </button>
            <button
              onClick={() => setEditOpen(true)}
              title="Edit"
              className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              title="Delete"
              className="p-1.5 rounded text-[var(--text-3)] hover:text-[var(--failure)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: statusColor }}>
          <Clock className="w-3 h-3" />
          <span>
            Last: {fmtDate(schedule.last_fired_at)}
            {schedule.last_status && (
              <span className="ml-1 font-medium uppercase">
                {schedule.last_status === 'forced' ? 'Manual' : schedule.last_status}
              </span>
            )}
          </span>
        </div>

        {schedule.contacts.length > 0 && (
          <div className="text-[10px] text-[var(--text-3)]">
            {schedule.contacts.length} contact{schedule.contacts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit schedule"
        width="480px"
      >
        <div className="p-5">
          <ScheduleForm
            initial={schedule}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
            isPending={update.isPending}
          />
        </div>
      </Sheet>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete schedule"
      >
        <p className="text-sm text-[var(--text-2)]">
          Are you sure you want to delete <strong>{schedule.name}</strong>? This will stop all future digest sends.
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={remove.isPending}
          >
            {remove.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
