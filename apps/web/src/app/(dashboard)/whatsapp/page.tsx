import { auth } from '@clerk/nextjs/server'
import { WhatsAppClient } from '@/components/whatsapp/WhatsAppClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function fetchData(token: string) {
  const [statsRes, messagesRes, templatesRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/whatsapp/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API_URL}/api/v1/whatsapp/messages?limit=30`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API_URL}/api/v1/whatsapp/templates`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  const stats = statsRes.ok
    ? await statsRes.json()
    : { total: 0, sent: 0, delivered: 0, failed: 0, read: 0, deliveryRate: 0, byTemplate: [] }
  const messages = messagesRes.ok ? await messagesRes.json() : { data: [], meta: { total: 0 } }
  const templates = templatesRes.ok ? await templatesRes.json() : []

  return { stats, messages, templates }
}

export default async function WhatsAppPage() {
  const { getToken } = await auth()
  const token = await getToken()

  if (!token) {
    return <div className="p-8 text-red-500">Authentication required</div>
  }

  const { stats, messages, templates } = await fetchData(token)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">WhatsApp</h1>
        <span className="text-xs text-gray-400">Powered by Twilio</span>
      </div>
      <WhatsAppClient
        initialStats={stats}
        initialMessages={messages}
        initialTemplates={templates}
      />
    </div>
  )
}
