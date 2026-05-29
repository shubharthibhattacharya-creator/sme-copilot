import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const { userId } = await auth()

  if (userId) {
    redirect('/dashboard')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center max-w-2xl px-4">
        <h1 className="text-5xl font-bold text-slate-900 mb-4">
          Ops<span className="text-blue-600">Copilot</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          AI-powered operations for Indian SMEs. Automate collections, inventory,
          and reporting — built for CA firms, distributors, and manufacturers.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started Free
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </main>
  )
}
