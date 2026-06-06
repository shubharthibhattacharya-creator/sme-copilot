import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-6">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-2">
          <Image
            src="/practora-logo.png"
            alt="Practora"
            width={200}
            height={70}
            style={{ objectFit: 'contain' }}
            priority
          />
          <p style={{ fontSize: 14, color: '#64748B', margin: 0, letterSpacing: '0.01em' }}>
            Your Firm, On Autopilot
          </p>
        </div>

        <SignIn />

        <p className="text-xs text-slate-400 text-center max-w-xs">
          Don&apos;t have an account? Contact your Practora administrator to get invited.
        </p>
      </div>
    </main>
  )
}
