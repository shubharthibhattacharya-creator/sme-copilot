import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { GstinVerificationStatus } from '@opsc/database'

const GSTN_API = 'https://api.gstin.gov.in/commonapi/search?action=TP&gstin='
const TIMEOUT_MS = 5000

export interface GstinLookupResult {
  status: GstinVerificationStatus
  legalName: string | null
  registrationStatus: string | null
}

@Injectable()
export class GstinService {
  private readonly logger = new Logger(GstinService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calls the public GSTN API and returns verification result.
   * Never throws — always returns a result including PENDING on failure.
   */
  async lookup(gstin: string): Promise<GstinLookupResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${GSTN_API}${gstin}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) {
        this.logger.warn(`GSTN API returned ${res.status} for ${gstin}`)
        return { status: 'PENDING', legalName: null, registrationStatus: null }
      }

      const data = await res.json() as {
        errorCode?: string
        tradeNam?: string
        lgnm?: string
        sts?: string
      }

      // GSTN returns errorCode "SWEB_9035" for not found
      if (data.errorCode) {
        return { status: 'NOT_FOUND', legalName: null, registrationStatus: null }
      }

      const legalName: string | null = data.lgnm ?? data.tradeNam ?? null
      const regStatus = data.sts ?? ''

      let status: GstinVerificationStatus
      const sts = regStatus.toLowerCase()
      if (sts.includes('cancel')) {
        status = 'CANCELLED'
      } else if (sts.includes('suspend')) {
        status = 'SUSPENDED'
      } else if (sts.includes('active') || sts.includes('provisional')) {
        status = 'VERIFIED'
      } else {
        // Unknown status string — treat as verified if we got a legal name
        status = legalName ? 'VERIFIED' : 'PENDING'
      }

      return { status, legalName, registrationStatus: regStatus }
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      this.logger.warn(`GSTN lookup ${isTimeout ? 'timed out' : 'failed'} for ${gstin}`)
      return { status: 'PENDING', legalName: null, registrationStatus: null }
    } finally {
      clearTimeout(timer)
    }
  }

  /**
   * Validates a GSTIN, stores the result on the client, and returns it.
   * Called after client create/update and by the retry cron.
   */
  async validateAndStore(clientId: string, gstin: string): Promise<GstinLookupResult> {
    const result = await this.lookup(gstin)

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        gstinVerificationStatus: result.status,
        gstinLegalName: result.legalName,
        gstinVerifiedAt: result.status !== 'PENDING' ? new Date() : undefined,
      },
    })

    return result
  }

  /**
   * Retry all clients whose GSTIN verification is still PENDING.
   * Called by the nightly cron at 3am IST.
   */
  async retryPending(): Promise<{ retried: number; resolved: number }> {
    const pending = await this.prisma.client.findMany({
      where: { gstinVerificationStatus: 'PENDING', gstin: { not: null } },
      select: { id: true, gstin: true },
    })

    if (pending.length === 0) return { retried: 0, resolved: 0 }

    let resolved = 0
    for (const client of pending) {
      try {
        const result = await this.validateAndStore(client.id, client.gstin!)
        if (result.status !== 'PENDING') resolved++
      } catch (err) {
        this.logger.error(`Retry failed for client ${client.id}`, err)
      }
    }

    this.logger.log(`GSTIN retry complete — retried=${pending.length}, resolved=${resolved}`)
    return { retried: pending.length, resolved }
  }
}
