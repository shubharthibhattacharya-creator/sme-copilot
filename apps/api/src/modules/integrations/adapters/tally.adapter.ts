import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import type {
  ITaxIntegrationAdapter,
  PushDocumentPayload,
  PushDocumentResult,
  FilingStatusResult,
} from '../tax-integration.interface'

const DEFAULT_BRIDGE_URL = 'http://localhost:9998'

@Injectable()
export class TallyAdapter implements ITaxIntegrationAdapter {
  private readonly logger = new Logger(TallyAdapter.name)

  constructor(private readonly prisma: PrismaService) {}

  private async bridgeUrl(companyId: string): Promise<string> {
    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })
    return integration.tallyBridgeUrl ?? DEFAULT_BRIDGE_URL
  }

  async testConnection(companyId: string): Promise<boolean> {
    try {
      const base = await this.bridgeUrl(companyId)
      const res = await fetch(`${base}/api/ping`, {
        signal: AbortSignal.timeout(10_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async pushDocument(companyId: string, payload: PushDocumentPayload): Promise<PushDocumentResult> {
    const base = await this.bridgeUrl(companyId)
    const integration = await this.prisma.taxIntegration.findUniqueOrThrow({
      where: { companyId },
    })

    const body = {
      companyName: integration.tallyCompanyName,
      gstin: payload.clientGstin,
      filingPeriod: payload.filingPeriod,
      documentId: payload.documentId,
      documentName: payload.originalName,
      documentType: payload.documentType,
    }

    const res = await fetch(`${base}/api/voucher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    const raw = (await res.json()) as { tallyId?: string }
    if (!res.ok) throw new Error(`Tally Bridge error: ${res.status} ${JSON.stringify(raw)}`)

    return { externalId: raw.tallyId ?? null, raw }
  }

  async getFilingStatus(
    companyId: string,
    gstin: string,
    period: string,
  ): Promise<FilingStatusResult> {
    const base = await this.bridgeUrl(companyId)

    const res = await fetch(
      `${base}/api/gst-status?gstin=${encodeURIComponent(gstin)}&period=${encodeURIComponent(period)}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    const raw = (await res.json()) as { status?: string }
    const status =
      raw.status === 'Filed' ? 'FILED' : raw.status === 'Pending' ? 'PENDING' : 'UNKNOWN'
    return { period, status, raw }
  }
}
