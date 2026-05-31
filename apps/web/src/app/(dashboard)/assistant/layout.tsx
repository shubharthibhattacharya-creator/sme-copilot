'use client'
import { RequireModule } from '@/components/auth/RequireModule'
export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return <RequireModule module="assistant">{children}</RequireModule>
}
