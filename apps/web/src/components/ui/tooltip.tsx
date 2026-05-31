'use client'
import React from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), 300)
  }
  const hide = () => {
    clearTimeout(timerRef.current)
    setVisible(false)
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0F172A',
            color: '#FFFFFF',
            fontSize: '11px',
            fontFamily: 'var(--font-family)',
            fontWeight: 500,
            padding: '4px 8px',
            borderRadius: '6px',
            whiteSpace: 'nowrap',
            zIndex: 50,
            pointerEvents: 'none',
            letterSpacing: '0.01em',
          }}
        >
          {content}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '4px solid #0F172A',
            }}
          />
        </div>
      )}
    </div>
  )
}
