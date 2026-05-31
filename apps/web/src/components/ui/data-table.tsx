'use client'
import React from 'react'
import { Body } from './typography'

export interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render: (row: T) => React.ReactNode
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: keyof T
  onRowClick?: (row: T) => void
  emptyState?: React.ReactNode
  stickyHeader?: boolean
  maxHeight?: string
}

export function DataTable<T>({
  columns, data, keyField, onRowClick, emptyState,
  stickyHeader, maxHeight,
}: DataTableProps<T>) {
  const containerStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
    ...(maxHeight ? { maxHeight, overflowY: 'auto' as const } : {}),
  }

  return (
    <div style={containerStyle}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 1 } : {}}>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid var(--color-border)' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '10px 14px',
                textAlign: col.align || 'left',
                fontFamily: 'var(--font-family)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                width: col.width,
                userSelect: 'none',
              }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '48px 24px', textAlign: 'center' }}>
                {emptyState || <Body secondary>No data</Body>}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background var(--transition-fast)',
                }}
                onMouseEnter={e => {
                  if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding: '11px 14px',
                    textAlign: col.align || 'left',
                    fontFamily: 'var(--font-family)',
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                    verticalAlign: 'middle',
                  }}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
