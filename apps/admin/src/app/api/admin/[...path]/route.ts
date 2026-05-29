import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.ADMIN_API_URL ?? 'http://localhost:3001'

async function proxyRequest(request: NextRequest, params: { path: string[] }) {
  // Verify admin session cookie
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')?.value
  const secret = process.env.ADMIN_SECRET ?? ''

  if (!session || session !== secret) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const path = params.path.join('/')
  const search = request.nextUrl.search
  const url = `${API_URL}/api/v1/admin/${path}${search}`

  const contentType = request.headers.get('content-type') ?? ''
  let body: BodyInit | null = null
  const forwardHeaders: Record<string, string> = { 'x-admin-secret': secret }

  if (contentType.includes('multipart/form-data')) {
    body = await request.formData()
    // Don't set Content-Type — fetch sets it automatically with boundary
  } else if (request.method !== 'GET' && request.method !== 'DELETE') {
    body = await request.text()
    forwardHeaders['Content-Type'] = 'application/json'
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: request.method,
      headers: forwardHeaders,
      body: body ?? undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reach API'
    return NextResponse.json(
      { message: `Proxy error: ${message} (ADMIN_API_URL=${API_URL})` },
      { status: 502 },
    )
  }

  const responseContentType = res.headers.get('content-type') ?? ''
  if (responseContentType.includes('application/json')) {
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  }

  const text = await res.text()
  // If the API returned a non-JSON body for a non-ok response, wrap it
  if (!res.ok) {
    return NextResponse.json({ message: text || `HTTP ${res.status}` }, { status: res.status })
  }
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': responseContentType },
  })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await params)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await params)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await params)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await params)
}
