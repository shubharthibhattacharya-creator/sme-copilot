import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common'
import { Webhook } from 'svix'
import { verifyToken, createClerkClient } from '@clerk/backend'
import { PrismaService } from '../../prisma/prisma.service'
import { INDUSTRY_DEFAULTS } from '@opsc/types'
import type { IndustryType } from '@opsc/types'

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name?: string
    last_name?: string
    public_metadata?: { industry?: IndustryType; companyName?: string }
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by the frontend after Clerk sign-up to ensure a DB user + company exist.
   * Idempotent — if the user already exists, returns immediately.
   * Also accepts dev:: bypass tokens in non-production environments.
   */
  async registerFromToken(token: string): Promise<{ ok: true }> {
    if (!token) throw new UnauthorizedException('Missing token')

    // Dev bypass — already has a DB record
    if (process.env['NODE_ENV'] !== 'production' && token.startsWith('dev::')) {
      return { ok: true }
    }

    let clerkUserId: string
    try {
      const payload = await verifyToken(token, { secretKey: process.env['CLERK_SECRET_KEY']! })
      clerkUserId = payload.sub
    } catch {
      throw new UnauthorizedException('Invalid or expired token')
    }

    // Check if already provisioned
    const existing = await this.prisma.user.findUnique({ where: { clerkId: clerkUserId } })
    if (existing) return { ok: true }

    // Fetch user details from Clerk
    const clerk = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY']! })
    const clerkUser = await clerk.users.getUser(clerkUserId)

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email
    const industry: IndustryType = (clerkUser.publicMetadata?.['industry'] as IndustryType | undefined) ?? 'DISTRIBUTOR'
    const companyName = (clerkUser.publicMetadata?.['companyName'] as string | undefined) ?? `${name}'s Company`

    await this.provisionUserAndCompany({ id: clerkUserId, email_addresses: [{ email_address: email }], first_name: clerkUser.firstName ?? undefined, last_name: clerkUser.lastName ?? undefined, public_metadata: { industry, companyName } })

    this.logger.log(`Self-provisioned user ${email} (${clerkUserId})`)
    return { ok: true }
  }

  async handleWebhook(headers: Record<string, string>, rawBody: Buffer) {
    const secret = process.env['CLERK_WEBHOOK_SECRET']!
    const wh = new Webhook(secret)

    let event: ClerkUserCreatedEvent
    try {
      event = wh.verify(rawBody, headers) as ClerkUserCreatedEvent
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.type === 'user.created') {
      await this.provisionUserAndCompany(event.data)
    }

    return { received: true }
  }

  private async provisionUserAndCompany(
    data: ClerkUserCreatedEvent['data'],
  ) {
    const email = data.email_addresses[0]?.email_address ?? ''
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || email
    const industry: IndustryType = data.public_metadata?.industry ?? 'DISTRIBUTOR'
    const companyName = data.public_metadata?.companyName ?? `${name}'s Company`

    const tenantConfig = INDUSTRY_DEFAULTS[industry]

    await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          industry,
          subscriptionPlan: 'STARTER',
          tenantConfig: JSON.parse(JSON.stringify(tenantConfig)),
        },
      })

      await tx.user.create({
        data: {
          clerkId: data.id,
          companyId: company.id,
          role: 'ADMIN',
          name,
          email,
        },
      })

      this.logger.log(`Provisioned company "${companyName}" for ${email}`)
    })
  }
}
