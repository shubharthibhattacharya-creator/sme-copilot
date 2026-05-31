'use client'
import React from 'react'
import { Tooltip } from './tooltip'

type ButtonColor = 'default' | 'whatsapp' | 'email' | 'call'

const colorMap: Record<ButtonColor, { hoverBg: string; icon: string }> = {
  default:  { hoverBg: 'var(--color-surface-hover)', icon: 'var(--color-text-secondary)' },
  whatsapp: { hoverBg: '#DCF8C6',                    icon: '#25D366' },
  email:    { hoverBg: '#EEF2FF',                    icon: 'var(--color-primary)' },
  call:     { hoverBg: '#F0FDF4',                    icon: 'var(--color-success)' },
}

interface ActionIconButtonProps {
  icon:      React.ReactNode
  label:     string
  onClick:   (e: React.MouseEvent) => void
  color?:    ButtonColor
  disabled?: boolean
  loading?:  boolean
}

function SmallSpinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  )
}

export function ActionIconButton({
  icon,
  label,
  onClick,
  color = 'default',
  disabled,
  loading,
}: ActionIconButtonProps) {
  const colors = colorMap[color]
  const [hovered, setHovered] = React.useState(false)
  const isDisabled = disabled || loading

  return (
    <Tooltip content={label}>
      <button
        aria-label={label}
        disabled={isDisabled}
        onClick={(e) => { e.stopPropagation(); onClick(e) }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '30px',
          height: '30px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: hovered && !isDisabled ? colors.hoverBg : 'transparent',
          color: colors.icon,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.4 : 1,
          transition: 'background var(--transition-fast)',
          flexShrink: 0,
          padding: 0,
        }}
      >
        {loading ? <SmallSpinner /> : icon}
      </button>
    </Tooltip>
  )
}
