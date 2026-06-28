import { useState } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus } from 'lucide-react'
import { useJobs, useCreateJob } from '../api'
import { SummaryBar } from '../components/SummaryBar'
import { JobCard } from '../components/JobCard'
import { JobForm } from '../components/JobForm'

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[95px] rounded-[7px]" />
      ))}
    </div>
  )
}

export function JobBoardPage() {
  const { data: jobs = [], isLoading } = useJobs()
  const createJob = useCreateJob()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Topbar
        title="Job Board"
        subtitle={`${jobs.length} jobs · refreshes every 30s`}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus size={12} />
            Add Job
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-5">
        <div className="flex flex-col gap-4">
          <SummaryBar jobs={jobs} />
          {isLoading ? (
            <SkeletonGrid />
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-3 text-4xl opacity-20">▦</div>
              <p className="text-sm font-medium text-[var(--text-1)]">No jobs registered</p>
              <p className="mt-1 text-xs text-[var(--text-3)]">
                Create a job and configure your backup scripts to send alerts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Create job"
        description="Register a new backup job to monitor"
      >
        <JobForm
          onSubmit={data => {
            createJob.mutate(data, { onSuccess: () => setOpen(false) })
          }}
          onCancel={() => setOpen(false)}
          isPending={createJob.isPending}
        />
      </Sheet>
    </div>
  )
}
