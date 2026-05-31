'use client'
import { RequireModule } from '@/components/auth/RequireModule'
export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <RequireModule module="reports">{children}</RequireModule>
}
