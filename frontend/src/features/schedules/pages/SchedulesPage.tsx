import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'
import { Sheet } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useSchedules, useCreateSchedule } from '../api'
import { ScheduleCard } from '../components/ScheduleCard'
import { ScheduleForm } from '../components/ScheduleForm'
import type { ScheduleCreate } from '../types'

export function SchedulesPage() {
  const { data: schedules = [], isLoading } = useSchedules()
  const create = useCreateSchedule()
  const [addOpen, setAddOpen] = useState(false)

  async function handleCreate(data: ScheduleCreate) {
    await create.mutateAsync(data)
    setAddOpen(false)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Schedules"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add schedule
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <span className="text-sm text-[var(--text-3)]">Loading schedules…</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm font-semibold text-[var(--text-1)]">No schedules yet</p>
            <p className="max-w-xs text-xs text-[var(--text-3)]">
              Add a schedule to send automated digest reports to your contacts on a cron schedule.
            </p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add schedule
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
            {schedules.map(s => (
              <ScheduleCard key={s.id} schedule={s} />
            ))}
          </div>
        )}
      </div>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add schedule"
        width="480px"
      >
        <div className="p-5">
          <ScheduleForm
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
            isPending={create.isPending}
          />
        </div>
      </Sheet>
    </div>
  )
}
