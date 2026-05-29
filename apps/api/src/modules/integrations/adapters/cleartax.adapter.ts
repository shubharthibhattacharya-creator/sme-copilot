import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import { EncryptionService } from '../../../common/encryption/encryption.service'
import type {
  ITaxIntegrationAdapter,
  PushDocumentPayload,
  PushDocumentResult,
  FilingStatusResult,
} from '../tax-integration.interface'

interface ClearTaxTokenCache {
  accessToken: string
  expiresAt: number
}

const TOKEN_CACHE = new Map<string, ClearTaxTokenCache>()

@Injectable()
export class ClearTaxAdapter implements ITaxIntegrationAdapter {
  private readonly logger = new Logger(ClearTaxAdapter.name)
  private readonly BASE = 'https://api.cleartax.in'

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
  ) {}

  private async getAccessToken(companyId: string): Promise<string> {
    const cached = TOKEN_CACHE.get(companyId)
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken

    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })

    const apiKey = this.enc.decrypt(integration.clearTaxApiKey!)
    const clientSecret = this.enc.decrypt(integration.clearTaxClientSecret!)

    const res = await fetch(`${this.BASE}/user/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: clientSecret,
      }),
    })
    if (!res.ok) throw new Error(`ClearTax token error: ${res.status}`)
    const data = (await res.json()) as { access_token: string; expires_in: number }

    TOKEN_CACHE.set(companyId, {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    })
    return data.access_token
  }

  async testConnection(companyId: string): Promise<boolean> {
    try {
      await this.getAccessToken(companyId)
      return true
    } catch {
      return false
    }
  }

  async pushDocument(companyId: string, payload: PushDocumentPayload): Promise<PushDocumentResult> {
    const token = await this.getAccessToken(companyId)
    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })

    const body = {
      gstin: payload.clientGstin,
      filing_period: payload.filingPeriod,
      document_id: payload.documentId,
      document_name: payload.originalName,
      org_id: integration.clearTaxOrgId,
    }

    const res = await fetch(`${this.BASE}/api/v2/gst/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const raw = (await res.json()) as { transaction_id?: string }
    if (!res.ok) throw new Error(`ClearTax push failed: ${res.status} ${JSON.stringify(raw)}`)

    return { externalId: raw.transaction_id ?? null, raw }
  }

  async getFilingStatus(
    companyId: string,
    gstin: string,
    period: string,
  ): Promise<FilingStatusResult> {
    const token = await this.getAccessToken(companyId)
    const res = await fetch(
      `${this.BASE}/api/v2/gst/filing-status?gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const raw = (await res.json()) as { status?: string }
    const status =
      raw.status === 'FILED' ? 'FILED' : raw.status === 'PENDING' ? 'PENDING' : 'UNKNOWN'
    return { period, status, raw }
  }
}
