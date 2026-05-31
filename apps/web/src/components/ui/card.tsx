'use client'
import React from 'react'
import { H3 } from './typography'
import { Body } from './typography'

interface CardProps {
  children: React.ReactNode
  padding?: string
  className?: string
  onClick?: () => void
  hoverable?: boolean
  style?: React.CSSProperties
}

export function Card({ children, padding = '20px 24px', hoverable, onClick, className, style }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
        padding,
        cursor: (onClick || hoverable) ? 'pointer' : 'default',
        transition: hoverable ? 'box-shadow var(--transition-base), border-color var(--transition-base)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '16px',
    }}>
      <div>
        <H3>{title}</H3>
        {subtitle && <Body secondary style={{ marginTop: '2px' }}>{subtitle}</Body>}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
