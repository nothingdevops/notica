import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPill } from './StatusPill'
import { formatDuration, formatRelative, formatTimeShort } from '@/lib/utils'
import type { AlertListItem } from '../types'

interface AlertTableProps {
  data: AlertListItem[]
  total: number
  page: number
  pageSize: number
  isLoading: boolean
  onPageChange: (p: number) => void
  onRowClick: (id: string) => void
}

export function AlertTable({
  data,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onRowClick,
}: AlertTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const columns: ColumnDef<AlertListItem>[] = [
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusPill status={row.original.status} />,
      size: 90,
    },
    {
      id: 'job_name',
      header: 'Job',
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-[var(--text-1)]">
          {row.original.job_name}
        </span>
      ),
    },
    {
      id: 'completion_time',
      header: 'Completed',
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-[var(--text-2)]">
          {formatTimeShort(row.original.completion_time)}
        </span>
      ),
      size: 110,
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: ({ row }) => (
        <span className="font-mono text-[11px] text-[var(--text-2)]">
          {formatDuration(row.original.duration_sec)}
        </span>
      ),
      size: 80,
    },
    {
      id: 'received_at',
      header: 'Received',
      cell: ({ row }) => (
        <span className="text-[11px] text-[var(--text-3)]">
          {formatRelative(row.original.received_at)}
        </span>
      ),
      size: 90,
    },
    {
      id: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const entries = Object.entries(row.original.tags).slice(0, 2)
        return (
          <div className="flex flex-wrap gap-1">
            {entries.map(([k, v]) => (
              <span
                key={k}
                className="rounded bg-[var(--bg-elevated)] px-1.5 py-px font-mono text-[9px] text-[var(--text-3)]"
              >
                {k}:{v}
              </span>
            ))}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="border-b border-[var(--border)] bg-[var(--bg-elevated)]">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]"
                    style={{ width: header.column.columnDef.size }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border-sub)]">
                    {columns.map((_, ci) => (
                      <td key={ci} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.length === 0
              ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-sm text-[var(--text-3)]">
                      No alerts found
                    </td>
                  </tr>
                )
              : table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row.original.id)}
                    className="cursor-pointer border-b border-[var(--border-sub)] bg-[var(--bg-card)] transition-colors hover:bg-[var(--bg-hover)] last:border-0"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-3)]">
          {total > 0
            ? `Page ${page} of ${totalPages} (${total} total)`
            : 'No results'}
        </span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight size={13} />
          </Button>
        </div>
      </div>
    </div>
  )
}
