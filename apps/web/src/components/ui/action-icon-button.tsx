'use client'
import React from 'react'
import { Tooltip } from './tooltip'

// Official WhatsApp logo SVG (speech bubble with phone handset)
export function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12.001 2C6.478 2 2 6.478 2 12c0 1.85.504 3.58 1.38 5.065L2.05 21.95l5.02-1.316A9.956 9.956 0 0012.001 22C17.523 22 22 17.522 22 12S17.523 2 12.001 2zm0 1.8A8.2 8.2 0 0120.2 12a8.2 8.2 0 01-8.199 8.2 8.166 8.166 0 01-4.163-1.134l-.298-.177-3.088.81.824-2.998-.196-.31A8.165 8.165 0 013.8 12 8.2 8.2 0 0112.001 3.8zm-2.29 3.938c-.198 0-.52.074-.792.37-.272.296-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.197 2.07 3.23 5.07 4.4.708.272 1.261.434 1.691.556.71.201 1.357.173 1.868.105.57-.076 1.755-.717 2.002-1.41.247-.693.247-1.287.173-1.41-.074-.123-.272-.197-.57-.346-.297-.148-1.755-.866-2.027-.964-.273-.099-.47-.149-.669.148-.198.298-.768.965-.94 1.163-.173.197-.347.222-.644.074-.297-.149-1.255-.463-2.39-1.474-.883-.786-1.48-1.757-1.653-2.054-.173-.298-.018-.459.13-.607.133-.132.297-.347.446-.52.148-.173.198-.298.297-.496.099-.198.05-.372-.025-.52-.074-.149-.669-1.611-.916-2.206-.241-.578-.487-.5-.669-.51a12.1 12.1 0 00-.57-.01z" />
    </svg>
  )
}

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
