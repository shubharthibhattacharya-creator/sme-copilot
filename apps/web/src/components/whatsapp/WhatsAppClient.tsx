'use client'
import { useState, useCallback } from 'react'
import { useApiClient } from '@/lib/client-api'
import { useApiError } from '@/hooks/useApiError'
import { usePermissions } from '@/contexts/permissions.context'
import { Card, CardHeader, Button } from '@/components/ui'

interface WhatsAppStats {
  total: number
  sent: number
  delivered: number
  failed: number
  read: number
  deliveryRate: number
  byTemplate: Array<{ key: string; count: number }>
}

interface WhatsAppMessage {
  id: string
  direction: 'OUTBOUND' | 'INBOUND'
  toPhone: string | null
  fromPhone: string | null
  templateKey: string
  body: string
  status: string
  sentAt: string | null
  createdAt: string
  metadata?: { numMedia?: number } | null
}

interface Template {
  id: string | null
  key: string
  name: string
  body: string
  variables: string[]
  isDefault: boolean
  isActive: boolean
}

interface Props {
  initialStats: WhatsAppStats
  initialMessages: { data: WhatsAppMessage[]; meta: { total: number } }
  initialTemplates: Template[]
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  DELIVERED: 'bg-green-100 text-green-700',
  READ: 'bg-indigo-100 text-indigo-700',
  FAILED: 'bg-red-100 text-red-700',
}

export function WhatsAppClient({ initialStats, initialMessages, initialTemplates }: Props) {
  const { request } = useApiClient()
  const { handleError } = useApiError()
  const { canDo } = usePermissions()
  const [tab, setTab] = useState<'overview' | 'messages' | 'templates'>('overview')
  const [stats, setStats] = useState(initialStats)
  const [messages, setMessages] = useState(initialMessages)
  const [templates, setTemplates] = useState(initialTemplates)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [editBody, setEditBody] = useState('')
  const [nudging, setNudging] = useState(false)
  const [nudgeResult, setNudgeResult] = useState<{ sent: number; failed: number } | null>(null)

  const refresh = useCallback(async () => {
    const [s, m] = await Promise.all([
      request<WhatsAppStats>('/whatsapp/stats'),
      request<{ data: WhatsAppMessage[]; meta: { total: number } }>('/whatsapp/messages?limit=30'),
    ])
    setStats(s)
    setMessages(m)
  }, [request])

  async function sendDeadlineNudge() {
    setNudging(true)
    try {
      const result = await request<{ sent: number; failed: number; total: number }>('/whatsapp/deadline-nudge', {
        method: 'POST',
      })
      setNudgeResult({ sent: result.sent, failed: result.failed })
      await refresh()
    } catch (err) {
      handleError(err)
    } finally {
      setNudging(false)
    }
  }

  async function saveTemplate() {
    if (!editingTemplate || !editBody.trim()) return
    try {
      await request(`/whatsapp/templates/${editingTemplate.key}`, {
        method: 'PUT',
        body: JSON.stringify({ body: editBody }),
      })
      const updated = await request<Template[]>('/whatsapp/templates')
      setTemplates(updated)
      setEditingTemplate(null)
    } catch (err) {
      handleError(err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['overview', 'messages', 'templates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Sent', value: stats.total },
              { label: 'Delivered', value: stats.delivered },
              { label: 'Read', value: stats.read },
              { label: 'Failed', value: stats.failed, highlight: stats.failed > 0 },
              { label: 'Delivery Rate', value: `${stats.deliveryRate}%` },
            ].map(({ label, value, highlight }) => (
              <Card key={label} padding="16px" style={highlight ? { borderColor: 'var(--color-error)', background: 'var(--color-error-light)' } : {}}>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-2xl font-semibold mt-1 ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
              </Card>
            ))}
          </div>

          {/* Failed alert */}
          {stats.failed > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {stats.failed} message{stats.failed > 1 ? 's' : ''} failed to send. Check template
              phone numbers.
            </div>
          )}

          {/* Template breakdown */}
          {stats.byTemplate.length > 0 && (
            <Card padding="20px">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Messages by template</h3>
              <div className="space-y-2">
                {stats.byTemplate.map((t) => (
                  <div key={t.key} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-600 w-32 shrink-0">{t.key}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min((t.count / stats.total) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{t.count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Inbound docs info */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-800 mb-1">📥 Auto-receive documents from clients</h3>
            <p className="text-xs text-green-700 leading-relaxed">
              When a client replies to any WhatsApp message with a photo or PDF, it is automatically saved
              to their <strong>Documents</strong> folder and OCR-processed.
              Tell clients: <em>"Just reply to this message with a photo of the document."</em>
            </p>
          </div>

          {/* Deadline nudge */}
          {canDo('whatsapp', 'bulk_send') && (
            <Card padding="20px">
              <CardHeader title="Bulk Deadline Nudge" subtitle="Send GST deadline reminder to all clients with overdue invoices (max 50)." />
              {nudgeResult && (
                <p className="text-sm text-green-700 mb-3">
                  Sent {nudgeResult.sent} · Failed {nudgeResult.failed}
                </p>
              )}
              <Button
                variant="primary"
                onClick={sendDeadlineNudge}
                disabled={nudging}
                loading={nudging}
              >
                Send Nudge to All Overdue Clients
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Messages Tab */}
      {tab === 'messages' && (
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-900">
              {messages.meta.total} messages
            </span>
            <Button variant="ghost" size="sm" onClick={refresh}>Refresh</Button>
          </div>
          <div className="divide-y divide-gray-100">
            {messages.data.length === 0 ? (
              <p className="text-sm text-gray-500 p-5">No messages yet.</p>
            ) : (
              messages.data.map((msg) => {
                const isInbound = msg.direction === 'INBOUND'
                const hasAttachment = (msg.metadata?.numMedia ?? 0) > 0
                const isDocReceived = isInbound && hasAttachment
                return (
                  <div key={msg.id} className={`px-5 py-3 flex items-start gap-3 ${isDocReceived ? 'bg-green-50' : ''}`}>
                    <span
                      className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isInbound ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isInbound ? '← IN' : '→ OUT'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500">
                          {msg.toPhone ?? msg.fromPhone ?? '—'}
                        </span>
                        {isDocReceived && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                            📎 Doc saved
                          </span>
                        )}
                        {!isDocReceived && (
                          <span className="text-xs font-mono text-gray-400">{msg.templateKey}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{msg.body}</p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                        STATUS_COLORS[msg.status] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {msg.status}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      )}

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div className="space-y-4">
          {templates.map((tmpl) => (
            <Card key={tmpl.key} padding="20px">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{tmpl.name}</h3>
                  <span className="text-xs text-gray-400 font-mono">{tmpl.key}</span>
                </div>
                {tmpl.isDefault && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    default
                  </span>
                )}
              </div>

              {editingTemplate?.key === tmpl.key ? (
                <div className="space-y-3">
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={8}
                    className="w-full text-sm font-mono border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400">
                    Variables: {tmpl.variables.map((v) => `{{${v}}}`).join(', ')}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={saveTemplate}>Save</Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans bg-gray-50 rounded p-3 mb-3">
                    {tmpl.body}
                  </pre>
                  {canDo('whatsapp', 'edit_templates') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTemplate(tmpl)
                        setEditBody(tmpl.body)
                      }}
                    >
                      Customise
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
