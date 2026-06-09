'use client'
import { useState, useRef, useEffect } from 'react'
import { useUser, SignOutButton } from '@clerk/nextjs'
import { ChevronDown, LogOut } from 'lucide-react'

export function SidebarUserSection() {
  const { user } = useUser()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  if (!user) return null

  const name = user.fullName ?? user.firstName ?? 'User'
  const initial = name.charAt(0).toUpperCase()
  const subtitle = 'Your Firm, On Autopilot'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background 150ms',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#F1F5F9')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
      >
        {/* Avatar */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0F172A',
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
            }}
          >
            {name}
          </p>
          <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.3, margin: 0 }}>
            {subtitle}
          </p>
        </div>

        <ChevronDown
          size={14}
          color="#94A3B8"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 200ms',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            minWidth: 180,
            marginTop: 6,
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(15,23,42,0.10)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <SignOutButton redirectUrl="/">
            <button
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#EF4444',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              <LogOut size={13} />
              Sign out
            </button>
          </SignOutButton>
        </div>
      )}
    </div>
  )
}
