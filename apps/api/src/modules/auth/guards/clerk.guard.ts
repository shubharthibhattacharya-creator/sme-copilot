import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { verifyToken } from '@clerk/backend'
import type { Request } from 'express'
import { PrismaService } from '../../../prisma/prisma.service'
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request>()

    // ── Admin impersonation bypass ───────────────────────────────────────────
    // The web app sends x-impersonation-company-id + x-admin-secret when an
    // OpsCopilot admin is viewing a tenant's dashboard. Load that company's
    // first ADMIN user as the authenticated context.
    const impersonationCompanyId = request.headers['x-impersonation-company-id'] as string | undefined
    if (impersonationCompanyId && request.headers['x-admin-secret'] === process.env['ADMIN_SECRET']) {
      const user = await this.prisma.user.findFirst({
        where: { companyId: impersonationCompanyId, role: 'ADMIN' },
        select: { id: true, clerkId: true, companyId: true, role: true, email: true, name: true },
      })
      if (!user) throw new UnauthorizedException('No admin user found for impersonated company')
      ;(request as Request & { user: AuthenticatedUser }).user = {
        clerkId: user.clerkId, userId: user.id, companyId: user.companyId,
        role: user.role, email: user.email, name: user.name,
      }
      return true
    }
    // ────────────────────────────────────────────────────────────────────────

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    const token = authHeader.slice(7)

    // ── Dev bypass ──────────────────────────────────────────────────────────
    // In development, accept tokens of the form "dev::<clerkId>" to load a
    // seeded user without a real Clerk JWT. Never active in production.
    if (process.env['NODE_ENV'] !== 'production' && token.startsWith('dev::')) {
      const clerkId = token.slice(5)
      const user = await this.prisma.user.findUnique({
        where: { clerkId },
        select: { id: true, clerkId: true, companyId: true, role: true, email: true, name: true },
      })
      if (!user) throw new UnauthorizedException(`Dev user not found: ${clerkId}`)
      ;(request as Request & { user: AuthenticatedUser }).user = {
        clerkId: user.clerkId, userId: user.id, companyId: user.companyId,
        role: user.role, email: user.email, name: user.name,
      }
      return true
    }
    // ────────────────────────────────────────────────────────────────────────

    let clerkUserId: string
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env['CLERK_SECRET_KEY']!,
      })
      clerkUserId = payload.sub
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    const user = await this.prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      select: {
        id: true,
        clerkId: true,
        companyId: true,
        role: true,
        email: true,
        name: true,
        isActive: true,
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found — complete onboarding first')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account suspended. Contact your administrator.')
    }

    const authenticatedUser: AuthenticatedUser = {
      clerkId: user.clerkId,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      name: user.name,
    }

    ;(request as Request & { user: AuthenticatedUser }).user = authenticatedUser
    return true
  }
}
