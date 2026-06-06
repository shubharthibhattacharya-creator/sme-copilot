export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { MyWorkClient } from '@/components/work-queue/MyWorkClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

interface WorkItem {
  id: string
  type: 'DOCUMENT' | 'INVOICE' | 'COMPLIANCE'
  module: string
  clientId: string
  clientName: string
  title: string
  dueDate: string | null
  urgency: 'TODAY' | 'THIS_WEEK' | 'NONE'
  meta: Record<string, unknown>
}

export default async function MyWorkPage() {
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-4 text-red-500">Authentication required</div>

  const res = await fetch(`${API_URL}/api/v1/my-work`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const items: WorkItem[] = res.ok ? await res.json() : []

  return <MyWorkClient items={items} />
}
