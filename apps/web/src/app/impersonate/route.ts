import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function errorResponse(request: NextRequest, title: string, message: string) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OpsCopilot</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh;background:#f9fafb;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:2rem;text-align:center;max-width:360px;width:100%}.icon{font-size:2rem;margin-bottom:.75rem}.title{font-size:1rem;font-weight:600;color:#111827;margin-bottom:.5rem}.msg{font-size:.875rem;color:#6b7280}</style>
</head>
<body><div class="card"><div class="icon">⏱</div><h1 class="title">${title}</h1><p class="msg">${message}</p></div></body>
</html>`
  return new NextResponse(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  })
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return errorResponse(request, 'No token provided', 'Please generate a new impersonation link from the admin panel.')
  }

  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return errorResponse(request, 'Server misconfiguration', 'ADMIN_SECRET not configured on web server.')
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/impersonate/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': adminSecret },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Invalid token' })) as { message?: string }
      return errorResponse(
        request,
        'Session expired or invalid',
        err.message ?? 'Please generate a new impersonation link from the admin panel.',
      )
    }

    const data = await res.json() as { companyId: string; companyName: string }

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('impersonation_session', `${data.companyId}:${encodeURIComponent(data.companyName)}`, {
      httpOnly: false, // needs to be readable by client JS for the banner
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 60,
      path: '/',
    })
    return response
  } catch {
    return errorResponse(request, 'Connection error', 'Could not verify token. Check API connectivity.')
  }
}
