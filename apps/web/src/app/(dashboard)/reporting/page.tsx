import { auth } from '@clerk/nextjs/server'
import { ReportingClient } from '@/components/reporting/ReportingClient'
import type { ReportItem } from '@opsc/types'

async function fetchReports(token: string): Promise<ReportItem[]> {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/reports`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  return res.ok ? (res.json() as Promise<ReportItem[]>) : []
}

export default async function ReportingPage() {
  const { getToken } = await auth()
  const token = await getToken()

  if (!token) {
    return <div className="p-8 text-red-500">Authentication required</div>
  }

  const reports = await fetchReports(token)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
      </div>
      <ReportingClient initialReports={reports} />
    </div>
  )
}
