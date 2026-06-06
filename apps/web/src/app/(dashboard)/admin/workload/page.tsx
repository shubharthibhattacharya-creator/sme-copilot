export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { WorkloadClient } from '@/components/work-queue/WorkloadClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface WorkloadEntry {
  userId: string
  name: string
  email: string
  role: string
  clientCount: number
  openDocuments: number
  overdueInvoices: number
  pendingChecklists: number
  totalOpen: number
}

export default async function WorkloadPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/admin/workload`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const entries: WorkloadEntry[] = res.ok ? await res.json() : []

  return <WorkloadClient entries={entries} />
}
