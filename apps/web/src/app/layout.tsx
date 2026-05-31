import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'OpsCopilot — AI Operations for Indian SMEs',
  description:
    'Automate collections, inventory, and reporting with AI-powered insights tailored for Indian businesses.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
