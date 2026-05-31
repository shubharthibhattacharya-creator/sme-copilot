'use client'
import React from 'react'
import { H3, Body, Label } from '@/components/ui/typography'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/ui/status-chip'
import { Icon } from '@/components/ui/icon'
import type { DocumentItem } from '@opsc/types'

interface DocumentViewerProps {
  document: DocumentItem
  onVerify: () => void
  onReject: (reason: string) => void
  onReprocess: () => void
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round((confidence ?? 0) * 100)
  const color = pct >= 80 ? 'var(--color-success)' : pct >= 60 ? 'var(--color-warning)' : 'var(--color-error)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <Label>OCR confidence</Label>
        <Label style={{ color }}>{pct}%</Label>
      </div>
      <div style={{ background: 'var(--color-border)', borderRadius: 'var(--radius-full)', height: '4px' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-full)', transition: 'width 0.3s ease' }} />
      </div>
    </div>
  )
}

function ExtractedFields({ data }: { data: Record<string, unknown> | null }) {
  const fields = Object.entries(data ?? {}).filter(([k, v]) => v !== null && v !== undefined && v !== '' && k !== 'confidence')
  if (fields.length === 0) return <Body secondary>No extracted data</Body>
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {fields.map(([key, value]) => (
        <div key={key} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '8px 0', borderBottom: '1px solid #F1F5F9',
        }}>
          <Label style={{ flex: '0 0 120px', color: 'var(--color-text-secondary)' }}>
            {key.replace(/([A-Z])/g, ' $1').trim()}
          </Label>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', textAlign: 'right', flex: 1 }}>
            {String(value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function DocumentViewer({ document, onVerify, onReject, onReprocess }: DocumentViewerProps) {
  const extractedData = document.extractedData as Record<string, unknown> | null
  const confidence = typeof (extractedData?.confidence) === 'number' ? extractedData.confidence as number : 0

  const chipStatus = document.status === 'VERIFIED' ? 'filed' as const
    : document.status === 'FAILED' ? 'overdue' as const
    : document.status === 'NEEDS_REVIEW' ? 'review' as const
    : 'pending' as const

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 340px',
      height: 'calc(100vh - 64px)',
      overflow: 'hidden',
    }}>
      {/* LEFT — document preview */}
      <div style={{
        background: '#F1F5F9',
        borderRight: '1px solid var(--color-border)',
        overflow: 'auto',
        padding: '24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}>
        {document.fileUrl ? (
          <iframe
            src={document.fileUrl}
            style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
            title="Document preview"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <Icon.Document size={40} color="var(--color-text-tertiary)" />
            <Body secondary style={{ marginTop: '12px' }}>Preview unavailable</Body>
          </div>
        )}
      </div>

      {/* RIGHT — extracted data + actions */}
      <div style={{ background: 'var(--color-surface)', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <H3>{document.documentType.replace(/_/g, ' ')}</H3>
            <StatusChip status={chipStatus} />
          </div>
          <ConfidenceBar confidence={confidence} />
        </div>

        <div style={{ padding: '16px 20px', flex: 1 }}>
          <Label uppercase style={{ marginBottom: '12px' }}>Extracted data</Label>
          <ExtractedFields data={extractedData} />
        </div>

        {(document.status === 'PROCESSED' || document.status === 'NEEDS_REVIEW') && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button variant="primary" onClick={onVerify} style={{ width: '100%' }}>Verify and save</Button>
            <Button variant="secondary" onClick={() => onReject('')} style={{ width: '100%' }}>Reject</Button>
            <Button variant="ghost" onClick={onReprocess}>Reprocess</Button>
          </div>
        )}
      </div>
    </div>
  )
}
