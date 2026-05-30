'use client'
import type { DocumentItem, SyncStatus } from '@opsc/types'

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

const STATUS_STYLES: Record<string, string> = {
  UPLOADED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PROCESSED: 'bg-amber-100 text-amber-700',
  FAILED: 'bg-red-100 text-red-700',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
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
}

export function DocumentList({ documents, onSelect }: Props) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No documents yet. Upload your first document to get started.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Sync</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {documents.map(doc => (
            <tr
              key={doc.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect(doc)}
            >
              <td className="px-4 py-3 font-medium text-gray-900 max-w-48 truncate">{doc.originalName}</td>
              <td className="px-4 py-3 text-gray-600">{doc.documentType.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[doc.status] ?? 'bg-gray-100 text-gray-700'}`}>
                  {doc.status === 'UPLOADED' || doc.status === 'PROCESSING'
                    ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
                    : null}
                  {doc.status}
                </span>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
