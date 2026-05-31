'use client'
import React from 'react'

export function H1({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 style={{
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--text-h1)',
      fontWeight: 'var(--weight-h1)',
      lineHeight: 'var(--lh-h1)',
      color: 'var(--color-text-primary)',
      margin: 0,
    }} className={className}>{children}</h1>
  )
}

export function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--text-h2)',
      fontWeight: 'var(--weight-h2)',
      lineHeight: 'var(--lh-h2)',
      color: 'var(--color-text-primary)',
      margin: 0,
    }} className={className}>{children}</h2>
  )
}

export function H3({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 style={{
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--text-h3)',
      fontWeight: 'var(--weight-h3)',
      lineHeight: 'var(--lh-h3)',
      color: 'var(--color-text-primary)',
      margin: 0,
    }} className={className}>{children}</h3>
  )
}

export function Body({ children, secondary, className, style }: {
  children: React.ReactNode
  secondary?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <p style={{
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--text-body)',
      fontWeight: 'var(--weight-body)',
      lineHeight: 'var(--lh-body)',
      color: secondary ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
      margin: 0,
      ...style,
    }} className={className}>{children}</p>
  )
}

export function Label({ children, uppercase, className, style }: {
  children: React.ReactNode
  uppercase?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span style={{
      fontFamily: 'var(--font-family)',
      fontSize: 'var(--text-label)',
      fontWeight: 'var(--weight-label)',
      lineHeight: 'var(--lh-label)',
      color: 'var(--color-text-secondary)',
      letterSpacing: uppercase ? '0.05em' : 'normal',
      textTransform: uppercase ? 'uppercase' : 'none',
      display: 'block',
      ...style,
    }} className={className}>{children}</span>
  )
}
