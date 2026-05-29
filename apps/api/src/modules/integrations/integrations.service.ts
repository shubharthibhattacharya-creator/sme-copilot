import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../prisma/prisma.service'
import { EncryptionService } from '../../common/encryption/encryption.service'
import { retryAsync } from '../../common/retry/retry.helper'
import { ClearTaxAdapter } from './adapters/cleartax.adapter'
import { ZohoAdapter } from './adapters/zoho.adapter'
import { TallyAdapter } from './adapters/tally.adapter'
import type { ITaxIntegrationAdapter, PushDocumentPayload } from './tax-integration.interface'
import type { SetupIntegrationDto } from './dto/setup-integration.dto'
import type { TaxProvider } from '@opsc/database'
import { Prisma } from '@opsc/database'

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: EncryptionService,
    private readonly config: ConfigService,
    private readonly clearTax: ClearTaxAdapter,
    private readonly zoho: ZohoAdapter,
    private readonly tally: TallyAdapter,
  ) {}

  private adapter(provider: TaxProvider): ITaxIntegrationAdapter {
    switch (provider) {
      case 'CLEARTAX': return this.clearTax
      case 'ZOHO_BOOKS': return this.zoho
      case 'TALLY': return this.tally
      default: throw new BadRequestException(`No adapter for provider: ${provider}`)
    }
  }

  // ── Setup / manage ──────────────────────────────────────────────────────────

  async setupIntegration(companyId: string, dto: SetupIntegrationDto) {
    const data: Record<string, unknown> = {
      provider: dto.provider,
      isActive: false,
    }

    if (dto.provider === 'CLEARTAX') {
      if (dto.clearTaxApiKey) data.clearTaxApiKey = this.enc.encrypt(dto.clearTaxApiKey)
      if (dto.clearTaxClientSecret) data.clearTaxClientSecret = this.enc.encrypt(dto.clearTaxClientSecret)
      if (dto.clearTaxOrgId) data.clearTaxOrgId = dto.clearTaxOrgId
    } else if (dto.provider === 'ZOHO_BOOKS') {
      if (dto.zohoClientId) data.zohoClientId = dto.zohoClientId
      if (dto.zohoClientSecret) data.zohoClientSecret = this.enc.encrypt(dto.zohoClientSecret)
      if (dto.zohoOrgId) data.zohoOrgId = dto.zohoOrgId
    } else if (dto.provider === 'TALLY') {
      if (dto.tallyBridgeUrl) data.tallyBridgeUrl = dto.tallyBridgeUrl
      if (dto.tallyCompanyName) data.tallyCompanyName = dto.tallyCompanyName
    }

    const integration = await this.prisma.taxIntegration.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    })

    return this.sanitize(integration)
  }

  async testConnection(companyId: string) {
    const integration = await this.prisma.taxIntegration.findUnique({ where: { companyId } })
    if (!integration || integration.provider === 'NONE') {
      return { ok: false, message: 'No integration configured' }
    }
    const ok = await this.adapter(integration.provider).testConnection(companyId)
    if (ok) {
      await this.prisma.taxIntegration.update({
        where: { companyId },
        data: { isActive: true, lastSyncStatus: 'SYNCED' },
      })
    }
    return { ok, message: ok ? 'Connection successful' : 'Connection failed' }
  }

  async disconnectIntegration(companyId: string) {
    await this.prisma.taxIntegration.update({
      where: { companyId },
      data: { provider: 'NONE', isActive: false },
    })
  }

  async getIntegration(companyId: string) {
    const integration = await this.prisma.taxIntegration.findUnique({ where: { companyId } })
    if (!integration) return null
    return this.sanitize(integration)
  }

  // ── Zoho OAuth flow ─────────────────────────────────────────────────────────

  getZohoAuthUrl(companyId: string): string {
    const clientId = this.config.getOrThrow<string>('ZOHO_CLIENT_ID')
    const redirectUri = this.config.getOrThrow<string>('ZOHO_REDIRECT_URI')
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'ZohoBooks.gstreturns.CREATE,ZohoBooks.gstreturns.READ',
      redirect_uri: redirectUri,
      access_type: 'offline',
      state: companyId,
    })
    return `https://accounts.zoho.in/oauth/v2/auth?${params.toString()}`
  }

  async handleZohoCallback(code: string, companyId: string) {
    await this.zoho.exchangeCodeAndSave(companyId, code)
    await this.prisma.taxIntegration.update({
      where: { companyId },
      data: { isActive: true, lastSyncStatus: 'SYNCED' },
    })
  }

  // ── Push document ───────────────────────────────────────────────────────────

  /**
   * Pushes a single document to the active integration.
   * Called manually from the UI or automatically after PROCESSED status.
   */
  async pushDocument(companyId: string, documentId: string): Promise<void> {
    const integration = await this.prisma.taxIntegration.findUnique({ where: { companyId } })
    if (!integration || !integration.isActive || integration.provider === 'NONE') {
      throw new BadRequestException('No active integration configured')
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, companyId },
      include: { client: { select: { gstin: true, name: true } } },
    })
    if (!document) throw new NotFoundException('Document not found')

    const fileUrl = document.storageKey // adapters use ID ref, not direct URL for now

    const payload: PushDocumentPayload = {
      documentId: document.id,
      originalName: document.originalName,
      documentType: document.documentType,
      filingPeriod: document.filingPeriod,
      fileUrl,
      clientGstin: document.client?.gstin ?? null,
      clientName: document.client?.name ?? '',
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: { syncStatus: 'SYNCING', syncProvider: integration.provider },
    })

    const logBase = {
      companyId,
      documentId,
      provider: integration.provider,
      direction: 'PUSH',
      payload: payload as unknown as Prisma.InputJsonValue,
    }

    try {
      const result = await this.adapter(integration.provider).pushDocument(companyId, payload)
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
          externalId: result.externalId,
          syncError: null,
        },
      })
      await this.prisma.taxSyncLog.create({
        data: { ...logBase, status: 'SYNCED', response: result.raw as Prisma.InputJsonValue },
      })
      await this.prisma.taxIntegration.update({
        where: { companyId },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'SYNCED' },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.prisma.document.update({
        where: { id: documentId },
        data: { syncStatus: 'FAILED', syncError: msg },
      })
      await this.prisma.taxSyncLog.create({
        data: { ...logBase, status: 'FAILED', errorMessage: msg },
      })
      await this.prisma.taxIntegration.update({
        where: { companyId },
        data: { lastSyncStatus: 'FAILED' },
      })
      throw err
    }
  }

  /**
   * Fire-and-forget: push document with retry. Does NOT throw.
   * No-ops if no active integration is configured.
   * Used internally after document reaches PROCESSED status.
   */
  pushDocumentWithRetry(companyId: string, documentId: string): void {
    this.prisma.taxIntegration
      .findUnique({ where: { companyId } })
      .then((integration) => {
        if (!integration || !integration.isActive || integration.provider === 'NONE') return
        retryAsync(
          () => this.pushDocument(companyId, documentId),
          this.logger,
          `push:${documentId}`,
        )
      })
      .catch((err: unknown) => {
        this.logger.warn(`pushDocumentWithRetry: failed to check integration for ${companyId}`, err)
      })
  }

  /** Push all PROCESSED documents that haven't been synced yet */
  async pushAllProcessed(companyId: string): Promise<{ queued: number }> {
    const integration = await this.prisma.taxIntegration.findUnique({ where: { companyId } })
    if (!integration || !integration.isActive || integration.provider === 'NONE') {
      throw new BadRequestException('No active integration configured')
    }

    const docs = await this.prisma.document.findMany({
      where: {
        companyId,
        status: 'PROCESSED',
        syncStatus: { in: ['PENDING', 'FAILED'] },
      },
      select: { id: true },
    })

    for (const doc of docs) {
      this.pushDocumentWithRetry(companyId, doc.id)
    }

    return { queued: docs.length }
  }

  // ── Sync logs ────────────────────────────────────────────────────────────────

  async getSyncLogs(companyId: string, limit = 20) {
    return this.prisma.taxSyncLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        document: { select: { id: true, originalName: true, documentType: true } },
      },
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private sanitize(integration: {
    id: string
    provider: TaxProvider
    isActive: boolean
    clearTaxApiKey?: string | null
    clearTaxClientSecret?: string | null
    clearTaxOrgId?: string | null
    zohoClientId?: string | null
    zohoClientSecret?: string | null
    zohoRefreshToken?: string | null
    zohoOrgId?: string | null
    tallyBridgeUrl?: string | null
    tallyCompanyName?: string | null
    lastSyncAt?: Date | null
    lastSyncStatus: string
    updatedAt: Date
  }) {
    return {
      id: integration.id,
      provider: integration.provider,
      isActive: integration.isActive,
      clearTaxApiKey: integration.clearTaxApiKey
        ? this.enc.mask(integration.clearTaxApiKey)
        : null,
      clearTaxOrgId: integration.clearTaxOrgId ?? null,
      zohoClientId: integration.zohoClientId ?? null,
      zohoOrgId: integration.zohoOrgId ?? null,
      tallyBridgeUrl: integration.tallyBridgeUrl ?? null,
      tallyCompanyName: integration.tallyCompanyName ?? null,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      updatedAt: integration.updatedAt,
    }
  }
}
