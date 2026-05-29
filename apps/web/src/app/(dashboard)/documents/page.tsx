import { auth } from '@clerk/nextjs/server'
import { DocumentsClient } from '@/components/documents/DocumentsClient'

async function fetchDocuments(token: string) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
  const [docsRes, reqsRes] = await Promise.all([
    fetch(`${apiUrl}/api/v1/documents?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${apiUrl}/api/v1/documents/requests`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  const documents = docsRes.ok ? await docsRes.json() : { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
  const requests = reqsRes.ok ? await reqsRes.json() : []
  return { documents, requests }
}

export default async function DocumentsPage() {
  const { getToken } = await auth()
  const token = await getToken()

  if (!token) {
    return <div className="p-8 text-red-500">Authentication required</div>
  }

  const { documents, requests } = await fetchDocuments(token)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
      </div>
      <DocumentsClient initialDocuments={documents} initialRequests={requests} />
    </div>
  )
}
