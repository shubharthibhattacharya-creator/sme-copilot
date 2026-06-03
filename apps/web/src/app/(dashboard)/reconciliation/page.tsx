import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { ReconUploadForm } from '@/components/reconciliation/ReconUploadForm'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface Gstr2bUpload {
  id: string
  filingPeriod: string
  fileFormat: string
  originalName: string
  status: string
  totalLineItems: number
  matchedCount: number
  possibleCount: number
  notInVaultCount: number
  notInGstr2bCount: number
  processedAt: string | null
  createdAt: string
  uploadedBy: { name: string }
  errorMessage: string | null
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

async function fetchUploads(token: string): Promise<Gstr2bUpload[]> {
  const res = await fetch(`${API_URL}/api/v1/reconciliation/gstr2b`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  return res.json() as Promise<Gstr2bUpload[]>
}

export default async function ReconciliationPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-8 text-red-500">Authentication required</div>

  const uploads = await fetchUploads(token)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">GSTR-2B Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Match your purchase invoices against GSTR-2B statements
          </p>
        </div>
      </div>

      <ReconUploadForm />

      {uploads.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          No GSTR-2B files uploaded yet
        </div>
      ) : (
        <div className="space-y-3">
          {uploads.map((u) => (
            <div key={u.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">{u.filingPeriod}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[u.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {u.status}
                    </span>
                    <span className="text-xs text-gray-400">{u.fileFormat}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{u.originalName} · uploaded by {u.uploadedBy.name}</p>
                  {u.errorMessage && (
                    <p className="text-xs text-red-500 mt-1">{u.errorMessage}</p>
                  )}
                </div>
                {u.status === 'COMPLETED' && (
                  <Link
                    href={`/reconciliation/${u.id}`}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    View results
                  </Link>
                )}
              </div>

              {u.status === 'COMPLETED' && u.totalLineItems > 0 && (
                <div className="mt-3 flex gap-4 text-xs">
                  <span className="text-green-700 font-medium">{u.matchedCount} matched</span>
                  <span className="text-amber-700 font-medium">{u.possibleCount} possible</span>
                  <span className="text-red-700 font-medium">{u.notInVaultCount} not in vault</span>
                  <span className="text-gray-500">{u.notInGstr2bCount} not in GSTR-2B</span>
                  <span className="text-gray-400 ml-auto">{u.totalLineItems} total lines</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
