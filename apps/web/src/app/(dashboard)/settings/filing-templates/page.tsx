export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { FilingTemplatesClient } from '@/components/settings/FilingTemplatesClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function fetchTemplates(token: string) {
  const res = await fetch(`${API_URL}/api/v1/compliance/templates`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? res.json() : []
}

export default async function FilingTemplatesPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const templates = await fetchTemplates(token)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Filing templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure which documents are required for each type of filing.
          These templates are used when creating compliance checklists for your clients.
        </p>
      </div>
      <FilingTemplatesClient initialTemplates={templates} />
    </div>
  )
}
