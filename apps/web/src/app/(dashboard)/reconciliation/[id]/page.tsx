import { auth } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import { ReconResultsClient } from '@/components/reconciliation/ReconResultsClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function fetchResults(token: string, id: string) {
  const res = await fetch(`${API_URL}/api/v1/reconciliation/gstr2b/${id}/results`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export default async function ReconResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { getToken } = await auth()
  const token = await getToken()
  if (!token) return <div className="p-8 text-red-500">Authentication required</div>

  const data = await fetchResults(token, id)
  if (!data) notFound()

  return <ReconResultsClient initialData={data} />
}
