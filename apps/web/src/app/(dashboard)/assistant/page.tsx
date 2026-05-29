import { auth } from '@clerk/nextjs/server'
import { AssistantClient } from '@/components/assistant/AssistantClient'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

async function fetchData(token: string) {
  const [convsRes, knowledgeRes] = await Promise.all([
    fetch(`${API_URL}/api/v1/assistant/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
    fetch(`${API_URL}/api/v1/assistant/knowledge`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ])

  const conversations = convsRes.ok ? await convsRes.json() : []
  const knowledge = knowledgeRes.ok ? await knowledgeRes.json() : []
  return { conversations, knowledge }
}

export default async function AssistantPage() {
  const { getToken } = await auth()
  const token = await getToken()

  if (!token) {
    return <div className="p-8 text-red-500">Authentication required</div>
  }

  const { conversations, knowledge } = await fetchData(token)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">AI Assistant</h1>
        <span className="text-xs text-gray-400">RAG · Powered by Claude</span>
      </div>
      <AssistantClient initialConversations={conversations} initialKnowledge={knowledge} />
    </div>
  )
}
