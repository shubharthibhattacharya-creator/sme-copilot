import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <SignIn />
        <p className="text-xs text-slate-400 text-center max-w-xs">
          Don&apos;t have an account? Contact your OpsCopilot administrator to get invited.
        </p>
      </div>
    </main>
  )
}
