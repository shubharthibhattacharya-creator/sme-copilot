'use client'
import React from 'react'

export type ChipStatus =
  | 'filed'
  | 'pending'
  | 'overdue'
  | 'waiting-client'
  | 'review'

const chipConfig: Record<ChipStatus, { bg: string; text: string; dot: string; label: string }> = {
  'filed':          { bg: 'var(--color-success-light)', text: 'var(--color-success-text)', dot: 'var(--color-success)',  label: 'Filed'          },
  'pending':        { bg: 'var(--color-warning-light)', text: 'var(--color-warning-text)', dot: 'var(--color-warning)',  label: 'Pending'        },
  'overdue':        { bg: 'var(--color-error-light)',   text: 'var(--color-error-text)',   dot: 'var(--color-error)',    label: 'Overdue'        },
  'waiting-client': { bg: 'var(--color-waiting-light)', text: 'var(--color-waiting-text)', dot: '#7C3AED',               label: 'Waiting client' },
  'review':         { bg: 'var(--color-review-light)',  text: 'var(--color-review-text)',  dot: '#3B82F6',               label: 'Under review'   },
}

interface StatusChipProps {
  status: ChipStatus
  label?: string
  size?: 'sm' | 'md'
}

export function StatusChip({ status, label, size = 'md' }: StatusChipProps) {
  const config = chipConfig[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      background: config.bg,
      color: config.text,
      borderRadius: 'var(--radius-full)',
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      fontSize: size === 'sm' ? '11px' : '12px',
      fontFamily: 'var(--font-family)',
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: config.dot,
        flexShrink: 0,
      }} />
      {label ?? config.label}
    </span>
  )
}

export const FiledChip   = (p: Omit<StatusChipProps, 'status'>) => <StatusChip status="filed"          {...p} />
export const PendingChip = (p: Omit<StatusChipProps, 'status'>) => <StatusChip status="pending"        {...p} />
export const OverdueChip = (p: Omit<StatusChipProps, 'status'>) => <StatusChip status="overdue"        {...p} />
export const WaitingChip = (p: Omit<StatusChipProps, 'status'>) => <StatusChip status="waiting-client" {...p} />
export const ReviewChip  = (p: Omit<StatusChipProps, 'status'>) => <StatusChip status="review"         {...p} />
