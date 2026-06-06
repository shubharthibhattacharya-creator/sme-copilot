import Link from 'next/link'
import Image from 'next/image'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #F0F4FF 0%, #EEF9F9 100%)',
        padding: '24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <Image
            src="/practora-logo.png"
            alt="Practora"
            width={440}
            height={154}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link
            href="/sign-in"
            style={{
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #1C3464 0%, #2563EB 100%)',
              color: '#FFFFFF',
              borderRadius: 10,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            Sign In
          </Link>
        </div>

        {/* Footer note */}
        <p style={{ marginTop: 32, fontSize: 12, color: '#CBD5E1' }}>
          Access is by invitation only. Contact your administrator to get started.
        </p>
      </div>
    </main>
  )
}
