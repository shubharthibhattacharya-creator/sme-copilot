'use client'
import type { DocumentItem, SyncStatus } from '@opsc/types'
import { Card, FiledChip, ReviewChip, OverdueChip, PendingChip } from '@/components/ui'

function SyncBadge({ status }: { status?: SyncStatus }) {
  if (!status || status === 'PENDING') return <span className="text-xs text-gray-300">—</span>
  const map: Record<SyncStatus, { label: string; cls: string }> = {
    PENDING:        { label: '—',       cls: 'text-gray-300' },
    SYNCING:        { label: 'Syncing', cls: 'text-blue-600 animate-pulse' },
    SYNCED:         { label: '✓ Synced',cls: 'text-green-600' },
    FAILED:         { label: '✗ Failed',cls: 'text-red-500' },
    NOT_APPLICABLE: { label: 'N/A',     cls: 'text-gray-400' },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'text-gray-400' }
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>
}


const PURPOSE_BADGE: Record<string, { label: string; cls: string }> = {
  RECEIVABLE:      { label: 'Fee invoice',   cls: 'bg-teal-100 text-teal-700' },
  TAX_PREPARATION: { label: 'Client doc',    cls: 'bg-purple-100 text-purple-700' },
  FIRM_RECORD:     { label: 'Firm record',   cls: 'bg-blue-100 text-blue-700' },
  UNKNOWN:         { label: 'Needs review',  cls: 'bg-amber-100 text-amber-700' },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface Props {
  documents: DocumentItem[]
  onSelect: (doc: DocumentItem) => void
  filters?: {
    documentType?: string
    status?: string
    documentPurpose?: string
  }
  onFilterChange?: (filters: { documentType?: string; status?: string; documentPurpose?: string }) => void
}

export function DocumentList({ documents, onSelect, filters = {}, onFilterChange }: Props) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No documents yet. Upload your first document to get started.
      </div>
    )
  }

  const documentTypes = Array.from(new Set(documents.map(d => d.documentType))).sort()
  const statuses = Array.from(new Set(documents.map(d => d.status))).sort()
  const purposes = Array.from(new Set(documents.map(d => d.documentPurpose).filter(Boolean)))

  return (
    <>
      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Type:</label>
          <select
            value={filters.documentType ?? ''}
            onChange={(e) => onFilterChange?.({ ...filters, documentType: e.target.value || undefined })}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {documentTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Status:</label>
          <select
            value={filters.status ?? ''}
            onChange={(e) => onFilterChange?.({ ...filters, status: e.target.value || undefined })}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Purpose:</label>
          <select
            value={filters.documentPurpose ?? ''}
            onChange={(e) => onFilterChange?.({ ...filters, documentPurpose: e.target.value || undefined })}
            className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All purposes</option>
            {purposes.map(p => (
              <option key={p} value={p}>{PURPOSE_BADGE[p as keyof typeof PURPOSE_BADGE]?.label ?? p}</option>
            ))}
          </select>
        </div>

        {(filters.documentType || filters.status || filters.documentPurpose) && (
          <button
            onClick={() => onFilterChange?.({ documentType: undefined, status: undefined, documentPurpose: undefined })}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <Card padding="0" style={{ overflow: 'hidden' }}>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Client</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Purpose</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Upload</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">OCR</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Sync</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {documents.map(doc => {
            return (
              <tr
                key={doc.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelect(doc)}
              >
                <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{doc.originalName}</td>
                <td className="px-4 py-3 text-gray-600">{doc.documentType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-gray-600 text-sm">{doc.client?.name ?? '—'}</td>

                {/* Purpose / classification badge */}
                <td className="px-4 py-3">
                  {doc.gstinConflict ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      Needs confirmation
                    </span>
                  ) : doc.documentPurpose ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${(PURPOSE_BADGE[doc.documentPurpose] ?? PURPOSE_BADGE['UNKNOWN']!).cls}`}>
                      {(PURPOSE_BADGE[doc.documentPurpose] ?? PURPOSE_BADGE['UNKNOWN']!).label}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>

                {/* Upload status — always saved if record exists */}
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Saved
                  </span>
                </td>

                {/* OCR / extraction status */}
                <td className="px-4 py-3">
                  {doc.status === 'PROCESSED' ? (
                    <FiledChip label="Done" size="sm" />
                  ) : doc.status === 'NEEDS_REVIEW' ? (
                    <ReviewChip label="Review" size="sm" />
                  ) : doc.status === 'PROCESSING' ? (
                    <ReviewChip label="Extracting…" size="sm" />
                  ) : doc.status === 'FAILED' ? (
                    <OverdueChip label="Failed" size="sm" />
                  ) : (
                    <PendingChip label="Pending" size="sm" />
                  )}
                </td>

                <td className="px-4 py-3">
                  {doc.syncStatus
                    ? <SyncBadge status={doc.syncStatus} />
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-500">{formatBytes(doc.fileSizeBytes)}</td>
                <td className="px-4 py-3 text-gray-500" suppressHydrationWarning>{formatDate(doc.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{doc.uploadedBy?.name ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}
