'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { ApiError } from '@/lib/api-error'
import { useApiError } from '@/hooks/useApiError'

interface Message {
  id?: string
  role: 'USER' | 'ASSISTANT'
  content: string
  citations?: Array<{ documentTitle: string; documentId: string }>
  createdAt?: string
}

interface Conversation {
  id: string
  title: string | null
  updatedAt: string
  _count: { messages: number }
  messages: Array<{ content: string; role: string; createdAt: string }>
}

interface KnowledgeDoc {
  id: string
  title: string
  category: string
  isActive: boolean
  createdAt: string
  _count: { chunks: number }
}

interface Props {
  initialConversations: Conversation[]
  initialKnowledge: KnowledgeDoc[]
}

export function AssistantClient({ initialConversations, initialKnowledge }: Props) {
  const { request } = useApiClient()
  const { handleError } = useApiError()
  const [tab, setTab] = useState<'chat' | 'knowledge'>('chat')
  const [conversations, setConversations] = useState(initialConversations)
  const [knowledge, setKnowledge] = useState(initialKnowledge)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [newDoc, setNewDoc] = useState({ title: '', category: 'GST_WORKFLOW', content: '' })
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversation = useCallback(
    async (id: string) => {
      const conv = await request<{ messages: Message[] }>(`/assistant/conversations/${id}`)
      setMessages(conv.messages)
      setActiveConvId(id)
    },
    [request],
  )

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)

    // Optimistically add user message
    setMessages((prev) => [...prev, { role: 'USER', content: text }])

    try {
      const result = await request<{
        conversationId: string
        answer: string
        citations: Array<{ documentTitle: string; documentId: string }>
      }>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, conversationId: activeConvId }),
      })

      setActiveConvId(result.conversationId)
      setMessages((prev) => [
        ...prev,
        { role: 'ASSISTANT', content: result.answer, citations: result.citations },
      ])

      // Refresh conversation list
      const convs = await request<Conversation[]>('/assistant/conversations')
      setConversations(convs)
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ASSISTANT', content: `Error: ${err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : 'Failed'}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  function startNewChat() {
    setActiveConvId(null)
    setMessages([])
    setInput('')
  }

  async function deleteConversation(id: string) {
    await request(`/assistant/conversations/${id}`, { method: 'DELETE' })
    if (activeConvId === id) startNewChat()
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }

  async function ingestDocument() {
    if (!newDoc.title || !newDoc.content) return
    setIngesting(true)
    try {
      await request('/assistant/knowledge', {
        method: 'POST',
        body: JSON.stringify(newDoc),
      })
      const docs = await request<KnowledgeDoc[]>('/assistant/knowledge')
      setKnowledge(docs)
      setNewDoc({ title: '', category: 'GST_WORKFLOW', content: '' })
    } catch (err) {
      handleError(err)
    } finally {
      setIngesting(false)
    }
  }

  async function deleteDoc(id: string) {
    await request(`/assistant/knowledge/${id}`, { method: 'DELETE' })
    setKnowledge((prev) => prev.filter((d) => d.id !== id))
  }

  const CATEGORIES = [
    'GST_WORKFLOW',
    'TDS_WORKFLOW',
    'CLIENT_ONBOARDING',
    'FILING_CHECKLIST',
    'COMPANY_POLICY',
    'GENERAL',
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['chat', 'knowledge'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t === 'chat' ? 'Chat' : 'Knowledge Base'}
          </button>
        ))}
      </div>

      {tab === 'chat' && (
        <div className="flex gap-4 h-[70vh]">
          {/* Conversation list */}
          <div className="w-56 shrink-0 flex flex-col gap-2">
            <button
              onClick={startNewChat}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              + New Chat
            </button>
            <div className="flex-1 overflow-y-auto space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer text-sm ${
                    activeConvId === conv.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span
                    className="flex-1 truncate"
                    onClick={() => loadConversation(conv.id)}
                  >
                    {conv.title ?? 'Untitled'}
                  </span>
                  <button
                    onClick={() => deleteConversation(conv.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Chat window */}
          <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-400">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-sm">Ask me anything about GST, TDS, or your firm's SOPs.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      msg.role === 'USER'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                        <p className="text-xs text-gray-500 font-medium">Sources:</p>
                        {msg.citations.map((c, ci) => (
                          <p key={ci} className="text-xs text-blue-600">
                            📄 {c.documentTitle}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about GST, TDS, filing deadlines…"
                disabled={loading}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'knowledge' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Existing docs */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">
              {knowledge.length} document{knowledge.length !== 1 ? 's' : ''}
            </h3>
            {knowledge.length === 0 && (
              <p className="text-sm text-gray-500">No documents yet. Add your first SOP.</p>
            )}
            {knowledge.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.category.replace(/_/g, ' ')} · {doc._count.chunks} chunks
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        doc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {doc.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add new doc */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-medium text-gray-900">Add Knowledge Document</h3>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Title</label>
              <input
                type="text"
                value={newDoc.title}
                onChange={(e) => setNewDoc((d) => ({ ...d, title: e.target.value }))}
                placeholder="GST Monthly Filing SOP"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Category</label>
              <select
                value={newDoc.category}
                onChange={(e) => setNewDoc((d) => ({ ...d, category: e.target.value }))}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">Content</label>
              <textarea
                value={newDoc.content}
                onChange={(e) => setNewDoc((d) => ({ ...d, content: e.target.value }))}
                rows={10}
                placeholder="Paste your SOP, policy document, or process description here…"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <button
              onClick={ingestDocument}
              disabled={ingesting || !newDoc.title || !newDoc.content}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {ingesting ? 'Ingesting…' : 'Ingest Document'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
