import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common'
import { Webhook } from 'svix'
import { verifyToken, createClerkClient } from '@clerk/backend'
import { PrismaService } from '../../prisma/prisma.service'
import { INDUSTRY_DEFAULTS } from '@opsc/types'
import type { IndustryType } from '@opsc/types'

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name?: string | null
    last_name?: string | null
    public_metadata?: Record<string, unknown>
  }
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called by the frontend after Clerk sign-up/sign-in to confirm DB record exists.
   * In production: only succeeds for users already provisioned via invite flow.
   * In development: auto-provisions if user doesn't exist yet.
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

    // Production: do not auto-provision — all users must come through invite flow
    if (process.env['NODE_ENV'] === 'production') {
      throw new UnauthorizedException('Account not provisioned. Contact your OpsCopilot administrator.')
    }

    // Development: auto-provision for convenience
    const clerk = createClerkClient({ secretKey: process.env['CLERK_SECRET_KEY']! })
    const clerkUser = await clerk.users.getUser(clerkUserId)

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || email
    const industry: IndustryType = (clerkUser.publicMetadata?.['industry'] as IndustryType | undefined) ?? 'CA_FIRM'
    const companyName = (clerkUser.publicMetadata?.['companyName'] as string | undefined) ?? `${name}'s Firm`

    await this.provisionNewTenant({ id: clerkUserId, email, name, industry, companyName })

    this.logger.log(`Dev: self-provisioned user ${email} (${clerkUserId})`)
    return { ok: true }
  }

  async handleWebhook(headers: Record<string, string>, rawBody: Buffer) {
    const secret = process.env['CLERK_WEBHOOK_SECRET']!
    const wh = new Webhook(secret)

    let event: ClerkWebhookEvent
    try {
      event = wh.verify(rawBody, headers) as ClerkWebhookEvent
    } catch {
      throw new BadRequestException('Invalid webhook signature')
    }

    if (event.type === 'user.created') {
      await this.handleUserCreated(event.data)
    }

    if (event.type === 'user.deleted') {
      await this.handleUserDeleted(event.data.id)
    }

    return { received: true }
  }

  private async handleUserCreated(data: ClerkWebhookEvent['data']) {
    const email = data.email_addresses[0]?.email_address ?? ''
    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || email
    const meta = data.public_metadata ?? {}
    const companyId = meta['companyId'] as string | undefined
    const invitedBy = meta['invitedBy'] as string | undefined
    const role = (meta['role'] as string | undefined) ?? 'STAFF'

    // ── Security check ────────────────────────────────────────────────────────
    // Only accept users invited through the OpsCopilot admin panel.
    // Anyone who signed up without an invite gets deleted immediately.
    if (!companyId || invitedBy !== 'opscopilot-admin') {
      this.logger.warn(`Uninvited user signup detected: ${email} — deleting from Clerk`)
      await this.deleteClerkUser(data.id)
      return
    }

    // Verify the target company exists and is active
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company || !company.isActive) {
      this.logger.warn(`User invited for unknown/inactive company ${companyId} — deleting`)
      await this.deleteClerkUser(data.id)
      return
    }

    // Check for placeholder user created by admin panel (clerkId: pending_{companyId})
    const placeholder = await this.prisma.user.findFirst({
      where: { companyId, clerkId: `pending_${companyId}` },
    })

    if (placeholder) {
      // Update placeholder with real Clerk ID (initial admin invite)
      await this.prisma.user.update({
        where: { id: placeholder.id },
        data: { clerkId: data.id, name, email, isActive: true },
      })
      this.logger.log(`Updated placeholder user → real clerkId for ${email} at ${company.name}`)
    } else {
      // Create new team member (invited from Settings → Team)
      const existing = await this.prisma.user.findUnique({ where: { clerkId: data.id } })
      if (!existing) {
        await this.prisma.user.create({
          data: {
            clerkId: data.id,
            companyId,
            role: role as never,
            name,
            email,
          },
        })
        this.logger.log(`Created team member ${email} (${role}) for ${company.name}`)
      }
    }
  }

  private async handleUserDeleted(clerkId: string) {
    await this.prisma.user.updateMany({
      where: { clerkId },
      data: { isActive: false },
    })
    this.logger.log(`Soft-deleted user with clerkId: ${clerkId}`)
  }

  private async deleteClerkUser(clerkId: string) {
    const secretKey = process.env['CLERK_SECRET_KEY']
    if (!secretKey) return
    try {
      const clerk = createClerkClient({ secretKey })
      await clerk.users.deleteUser(clerkId)
    } catch (err) {
      this.logger.error(`Failed to delete Clerk user ${clerkId}: ${String(err)}`)
    }
  }

  /** Development only — creates a full company + user record */
  private async provisionNewTenant(data: {
    id: string; email: string; name: string
    industry: IndustryType; companyName: string
  }) {
    const tenantConfig = INDUSTRY_DEFAULTS[data.industry]
    await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          industry: data.industry,
          subscriptionPlan: 'STARTER',
          tenantConfig: JSON.parse(JSON.stringify(tenantConfig)),
        },
      })
      await tx.user.create({
        data: {
          clerkId: data.id,
          companyId: company.id,
          role: 'ADMIN',
          name: data.name,
          email: data.email,
        },
      })
      this.logger.log(`Dev: provisioned company "${data.companyName}" for ${data.email}`)
    })
  }
}
