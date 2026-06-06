import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'

const FEATURES = [
  {
    icon: '🤖',
    bg: '#EDE9FE',
    title: 'Automate Manual Work',
    desc: 'From client communication to compliance, we automate it all.',
  },
  {
    icon: '📈',
    bg: '#DBEAFE',
    title: 'Track Everything',
    desc: 'Real-time insights on tasks, documents, filings & collections.',
  },
  {
    icon: '🛡️',
    bg: '#DCFCE7',
    title: 'Stay Compliant',
    desc: 'Never miss a deadline with smart alerts and workflows.',
  },
  {
    icon: '🤝',
    bg: '#FEF3C7',
    title: 'Delight Your Clients',
    desc: 'Faster responses, seamless collaboration and complete transparency.',
  },
]

const ACTIVITY_CARDS = [
  { icon: '✅', label: 'GST Filed', color: '#16A34A', bg: '#DCFCE7' },
  { icon: '👤', label: 'Client Updated', color: '#7C3AED', bg: '#EDE9FE' },
  { icon: '📄', label: 'Invoice Reconciled', color: '#D97706', bg: '#FEF3C7' },
  { icon: '₹', label: 'Payment Received', color: '#2563EB', bg: '#DBEAFE' },
]

export default function SignInPage() {
  return (
    <main style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Left marketing panel ── */}
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(145deg, #ECEEFF 0%, #E8E4FF 40%, #EDE8FF 70%, #F0EAFF 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '44px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div>
          <Image
            src="/practora-logo.png"
            alt="Practora"
            width={160}
            height={56}
            style={{ objectFit: 'contain', objectPosition: 'left' }}
            priority
          />
        </div>

        {/* Headline */}
        <div style={{ marginTop: 56, maxWidth: 460 }}>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1.15,
              margin: 0,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            Run Your Firm.
            <br />
            <span style={{ color: '#4F46E5' }}>Not Your Follow-Ups.</span>
          </h1>
          <div
            style={{
              width: 44,
              height: 4,
              background: 'linear-gradient(90deg, #4F46E5 0%, #818CF8 100%)',
              borderRadius: 2,
              marginTop: 18,
            }}
          />
          <p
            style={{
              marginTop: 18,
              fontSize: 15,
              color: '#475569',
              lineHeight: 1.7,
              maxWidth: 360,
            }}
          >
            Practora automates your day-to-day operations, so you can focus on what truly matters.
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {FEATURES.map(({ icon, bg, title, desc }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 1.55 }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating activity cards */}
        <div
          style={{
            position: 'absolute',
            right: 48,
            top: '28%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {ACTIVITY_CARDS.map(({ icon, label, color, bg }, i) => (
            <div
              key={label}
              style={{
                background: 'white',
                borderRadius: 14,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 20px rgba(79,70,229,0.12)',
                fontSize: 13,
                fontWeight: 500,
                color: '#1E293B',
                minWidth: 190,
                transform: `translateX(${i % 2 === 0 ? 0 : 20}px)`,
                border: '1px solid rgba(255,255,255,0.8)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              {label}
            </div>
          ))}
        </div>

        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.08)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.07)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* ── Right sign-in panel ── */}
      <div
        style={{
          width: 500,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          padding: '48px 40px',
          boxShadow: '-4px 0 32px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <SignIn
            appearance={{
              variables: {
                colorPrimary: '#4F46E5',
                colorText: '#0F172A',
                colorTextSecondary: '#64748B',
                colorBackground: '#FFFFFF',
                colorInputBackground: '#F8FAFC',
                colorInputText: '#0F172A',
                borderRadius: '10px',
                fontFamily: 'system-ui, sans-serif',
              },
              elements: {
                rootBox: { width: '100%' },
                card: {
                  boxShadow: 'none',
                  padding: '0',
                  border: 'none',
                  backgroundColor: 'transparent',
                },
                headerTitle: {
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#0F172A',
                },
                headerSubtitle: {
                  color: '#64748B',
                  fontSize: '14px',
                },
                formButtonPrimary: {
                  background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                  boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                  fontSize: '14px',
                  fontWeight: '600',
                  padding: '10px',
                },
                formFieldInput: {
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  fontSize: '14px',
                },
                socialButtonsBlockButton: {
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#374151',
                  fontWeight: '500',
                  fontSize: '14px',
                },
                dividerLine: { backgroundColor: '#E2E8F0' },
                dividerText: { color: '#94A3B8', fontSize: '12px' },
                footerActionLink: {
                  color: '#4F46E5',
                  fontWeight: '600',
                },
                identityPreviewEditButton: { color: '#4F46E5' },
              },
            }}
          />

          {/* Security badges */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              justifyContent: 'center',
              gap: 20,
              fontSize: 11,
              color: '#94A3B8',
              borderTop: '1px solid #F1F5F9',
              paddingTop: 20,
            }}
          >
            <span>🔒 Bank-level Security</span>
            <span>☁️ Secure Cloud Backup</span>
            <span>✓ Your Data is Safe</span>
          </div>
        </div>
      </div>
    </main>
  )
}
