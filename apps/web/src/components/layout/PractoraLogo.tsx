interface Props {
  iconSize?: number
  showText?: boolean
  subtitle?: string | null
}

export function PractoraIcon({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 108 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left facet — dark teal */}
      <path d="M4 34 L46 21 L54 78 L4 52 Z" fill="#1A7E90" />
      {/* Right facet — light cyan */}
      <path d="M104 34 L62 21 L54 78 L104 52 Z" fill="#00C2D5" />
      {/* Arrow — dark navy, rises above the frame */}
      <path
        d="M54 4 L37 30 L46 30 L46 60 L62 60 L62 30 L71 30 Z"
        fill="#1C3464"
      />
    </svg>
  )
}

export function PractoraLogo({ iconSize = 38, showText = true, subtitle }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <PractoraIcon size={iconSize} />
      {showText && (
        <div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#1C3464',
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: '-0.3px',
            }}
          >
            Practora
          </p>
          {subtitle && (
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.3 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
