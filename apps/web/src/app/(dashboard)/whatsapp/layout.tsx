'use client'
import { RequireModule } from '@/components/auth/RequireModule'
export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return <RequireModule module="whatsapp">{children}</RequireModule>
}
