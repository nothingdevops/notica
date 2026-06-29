import type { TopFailingJob } from '../types'

interface Props {
  jobs: TopFailingJob[]
}

export function TopFailingJobs({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="flex h-24 flex-col items-center justify-center gap-2 text-[var(--text-3)]">
        {/* Shield check icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-40"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        <span className="text-[11px]">No failures in last 7 days</span>
      </div>
    )
  }

  const max = jobs[0].failure_count

  return (
    <div className="flex flex-col gap-2.5">
      {jobs.map((j, i) => (
        <div key={j.job_name} className="flex items-center gap-3">
          {/* Rank badge */}
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-[var(--bg-elevated)] font-mono text-[10px] font-semibold text-[var(--text-3)]">
            {i + 1}
          </span>

          {/* Job name */}
          <span
            className="w-28 flex-shrink-0 truncate font-mono text-[11px] text-[var(--text-2)]"
            title={j.job_name}
          >
            {j.job_name}
          </span>

          {/* Progress bar */}
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
            <div
              className="absolute left-0 top-0 h-full rounded-full"
              style={{
                width: `${(j.failure_count / max) * 100}%`,
                background: 'var(--failure)',
                opacity: 0.65,
              }}
            />
          </div>

          {/* Count */}
          <span className="w-8 flex-shrink-0 text-right font-mono text-[11px] font-bold text-[var(--failure)]">
            {j.failure_count}
          </span>
        </div>
      ))}
    </div>
  )
}
