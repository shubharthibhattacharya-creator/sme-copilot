import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'
import { EncryptionService } from '../../../common/encryption/encryption.service'
import type {
  ITaxIntegrationAdapter,
  PushDocumentPayload,
  PushDocumentResult,
  FilingStatusResult,
} from '../tax-integration.interface'

interface ZohoTokenCache {
  accessToken: string
  expiresAt: number
}

const TOKEN_CACHE = new Map<string, ZohoTokenCache>()
const ZOHO_TOKEN_URL = 'https://accounts.zoho.in/oauth/v2/token'
const ZOHO_BOOKS_BASE = 'https://www.zohoapis.in/books/v3'

@Injectable()
export class ZohoAdapter implements ITaxIntegrationAdapter {
  private readonly logger = new Logger(ZohoAdapter.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  private async getAccessToken(companyId: string): Promise<string> {
    const cached = TOKEN_CACHE.get(companyId)
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken

    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })

    const clientId = integration.zohoClientId!
    const clientSecret = this.enc.decrypt(integration.zohoClientSecret!)
    const refreshToken = this.enc.decrypt(integration.zohoRefreshToken!)

    const res = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })
    if (!res.ok) throw new Error(`Zoho token refresh failed: ${res.status}`)
    const data = (await res.json()) as { access_token: string; expires_in: number }

    TOKEN_CACHE.set(companyId, {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    })
    return data.access_token
  }

  /** Exchange auth code for refresh + access tokens and persist (encrypted) */
  async exchangeCodeAndSave(
    companyId: string,
    code: string,
  ): Promise<void> {
    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })
    const redirectUri = this.config.getOrThrow<string>('ZOHO_REDIRECT_URI')

    const res = await fetch(ZOHO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: integration.zohoClientId!,
        client_secret: this.enc.decrypt(integration.zohoClientSecret!),
        redirect_uri: redirectUri,
        code,
      }),
    })
    if (!res.ok) throw new Error(`Zoho code exchange failed: ${res.status}`)
    const data = (await res.json()) as {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    await this.prisma.taxIntegration.update({
      where: { companyId },
      data: {
        zohoRefreshToken: this.enc.encrypt(data.refresh_token),
        isActive: true,
      },
    })

    TOKEN_CACHE.set(companyId, {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    })
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
      gst_return_period: payload.filingPeriod,
      gstin: payload.clientGstin,
      document_reference: payload.documentId,
      document_name: payload.originalName,
    }

    const res = await fetch(
      `${ZOHO_BOOKS_BASE}/gstreturns?organization_id=${integration.zohoOrgId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Zoho-oauthtoken ${token}`,
        },
        body: JSON.stringify(body),
      },
    )
    const raw = (await res.json()) as { gst_return?: { gstreturn_id?: string } }
    if (!res.ok) throw new Error(`Zoho push failed: ${res.status} ${JSON.stringify(raw)}`)

    return {
      externalId: raw.gst_return?.gstreturn_id ?? null,
      raw,
    }
  }

  async getFilingStatus(
    companyId: string,
    gstin: string,
    period: string,
  ): Promise<FilingStatusResult> {
    const token = await this.getAccessToken(companyId)
    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })

    const res = await fetch(
      `${ZOHO_BOOKS_BASE}/gstreturns?organization_id=${integration.zohoOrgId}&gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } },
    )
    const raw = (await res.json()) as { filing_status?: string }
    const status =
      raw.filing_status === 'FILED'
        ? 'FILED'
        : raw.filing_status === 'PENDING'
          ? 'PENDING'
          : 'UNKNOWN'
    return { period, status, raw }
  }
}
