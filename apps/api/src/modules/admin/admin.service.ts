import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigService } from '../config/config.service'
import { KnowledgeService } from '../ai-assistant/knowledge.service'
import { INDUSTRY_DEFAULTS } from '@opsc/types'
import type { IndustryType } from '@opsc/types'
import type { KnowledgeCategory } from '@opsc/database'

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const VALID_FILER_TYPES = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configSvc: ConfigService,
    private readonly knowledge: KnowledgeService,
  ) {}

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getPlatformStats() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalTenants, totalClients, totalDocuments, totalWhatsapp,
      aiCallsToday, storageDocs, recentUsers,
    ] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.client.count(),
      this.prisma.document.count(),
      this.prisma.whatsAppMessage.count(),
      this.prisma.aIInsight.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.document.aggregate({ _sum: { fileSizeBytes: true } }),
      this.prisma.user.count({ where: { updatedAt: { gte: thirtyDaysAgo } } }),
    ])

    // Count tenants with user activity in last 30 days
    const activeCompanyIds = await this.prisma.user.groupBy({
      by: ['companyId'],
      where: { updatedAt: { gte: thirtyDaysAgo } },
    })

    // Rough revenue estimate by plan
    const planCounts = await this.prisma.company.groupBy({ by: ['subscriptionPlan'], _count: true })
    const PLAN_PRICE: Record<string, number> = { STARTER: 2999, GROWTH: 7999, ENTERPRISE: 19999 }
    const revenue = planCounts.reduce((sum, p) => sum + (PLAN_PRICE[p.subscriptionPlan] ?? 0) * p._count, 0)

    return {
      totalTenants,
      activeTenants: activeCompanyIds.length,
      totalClients,
      totalDocuments,
      totalWhatsappMessages: totalWhatsapp,
      aiCallsToday,
      storageUsedMB: Math.round((storageDocs._sum.fileSizeBytes ?? 0) / (1024 * 1024)),
      revenueThisMonth: `₹${revenue.toLocaleString('en-IN')}`,
    }
  }

  // ── Tenant list ──────────────────────────────────────────────────────────────

  async listTenants() {
    const companies = await this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, clients: true, invoices: true, documents: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return companies.map((c) => ({
      id: c.id,
      name: c.name,
      industry: c.industry,
      subscriptionPlan: c.subscriptionPlan,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      userCount: c._count.users,
      clientCount: c._count.clients,
      invoiceCount: c._count.invoices,
      documentCount: c._count.documents,
      lastActivityAt: c.auditLogs[0]?.createdAt.toISOString() ?? null,
      tenantConfig: c.tenantConfig as Record<string, unknown>,
    }))
  }

  // ── Tenant detail ────────────────────────────────────────────────────────────

  async getTenant(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true, updatedAt: true } },
        clients: { select: { id: true, name: true, gstin: true, filerType: true, isActive: true } },
        _count: { select: { invoices: true, documents: true, reports: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!company) throw new NotFoundException('Tenant not found')

    const [overdueInvoices, whatsappThisMonth] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { companyId: id, status: 'OVERDUE' },
        _sum: { amount: true },
      }),
      this.prisma.whatsAppMessage.count({
        where: {
          companyId: id,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          direction: 'OUTBOUND',
        },
      }),
    ])

    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      subscriptionPlan: company.subscriptionPlan,
      isActive: company.isActive,
      createdAt: company.createdAt.toISOString(),
      gstNumber: company.gstNumber,
      panNumber: company.panNumber,
      phone: company.phone,
      address: company.address,
      userCount: company.users.length,
      clientCount: company.clients.length,
      invoiceCount: company._count.invoices,
      documentCount: company._count.documents,
      reportCount: company._count.reports,
      overdueAmount: overdueInvoices._sum.amount ?? 0,
      lastActivityAt: company.auditLogs[0]?.createdAt.toISOString() ?? null,
      tenantConfig: company.tenantConfig as Record<string, unknown>,
      users: company.users.map((u) => ({ ...u, updatedAt: u.updatedAt.toISOString() })),
      clients: company.clients,
      whatsappStats: { sentThisMonth: whatsappThisMonth, deliveryRate: 0.92 },
    }
  }

  // ── Create tenant ────────────────────────────────────────────────────────────

  async createTenant(dto: {
    name: string
    industry: IndustryType
    subscriptionPlan: string
    adminEmail: string
    adminName: string
    gstNumber?: string
    panNumber?: string
    phone?: string
    address?: string
    modulesEnabled?: string[]
  }) {
    const defaults = INDUSTRY_DEFAULTS[dto.industry]
    const tenantConfig = {
      ...defaults,
      ...(dto.modulesEnabled ? { modulesEnabled: dto.modulesEnabled } : {}),
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        industry: dto.industry,
        subscriptionPlan: dto.subscriptionPlan as never,
        tenantConfig,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        phone: dto.phone,
        address: dto.address,
      },
    })

    // Create admin user (clerkId placeholder — will be updated on first login)
    const placeholderClerkId = `pending_${company.id}`
    await this.prisma.user.create({
      data: {
        companyId: company.id,
        clerkId: placeholderClerkId,
        role: 'ADMIN',
        email: dto.adminEmail,
        name: dto.adminName,
      },
    })

    // Seed WhatsApp templates
    await this.seedWhatsAppTemplates(company.id)

    // Audit log — uses the admin user we just created
    const adminUser = await this.prisma.user.findFirst({ where: { companyId: company.id } })
    if (adminUser) {
      await this.prisma.auditLog.create({
        data: {
          companyId: company.id,
          userId: adminUser.id,
          action: 'TENANT_CREATED',
          entity: 'Company',
          entityId: company.id,
          metadata: { createdBy: 'admin_panel', adminEmail: dto.adminEmail },
        },
      }).catch(() => undefined)
    }

    // Send Clerk invite
    let clerkInviteSent = false
    try {
      await this.sendClerkInvite(dto.adminEmail, company.id, 'ADMIN')
      clerkInviteSent = true
    } catch (err) {
      this.logger.warn(`Clerk invite failed for ${dto.adminEmail}: ${String(err)}`)
    }

    return { ...company, clerkInviteSent }
  }

  async resendInvite(tenantId: string, email: string, role = 'ADMIN') {
    const company = await this.prisma.company.findUnique({ where: { id: tenantId } })
    if (!company) throw new Error('Tenant not found')
    await this.sendClerkInvite(email, tenantId, role)
    return { ok: true, message: `Invite sent to ${email}` }
  }

  async sendClerkInvite(
    email: string,
    companyId: string,
    role: string = 'ADMIN',
  ) {
    const secretKey = process.env['CLERK_SECRET_KEY']
    if (!secretKey) {
      this.logger.warn('CLERK_SECRET_KEY not set — skipping invite')
      return
    }
    const res = await fetch('https://api.clerk.com/v1/invitations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        public_metadata: {
          companyId,
          role,
          invitedBy: 'opscopilot-admin',
        },
        redirect_url: `${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/onboarding`,
        notify: true,
      }),
    })
    if (!res.ok) {
      const err = await res.json() as { errors?: Array<{ message: string }> }
      throw new Error(err.errors?.[0]?.message ?? `Clerk API error ${res.status}`)
    }
    this.logger.log(`Clerk invite sent to ${email} for company ${companyId} (role: ${role})`)
  }

  private async seedWhatsAppTemplates(companyId: string) {
    const templates = [
      {
        key: 'fee_reminder',
        name: 'Fee Reminder',
        body: 'Dear {{clientName}}, your professional fee of ₹{{amount}} is due on {{dueDate}}. Please arrange payment at your earliest convenience. — {{firmName}}',
        variables: ['clientName', 'amount', 'dueDate', 'firmName'],
      },
      {
        key: 'doc_request',
        name: 'Document Request',
        body: 'Dear {{clientName}}, we require {{documentType}} for {{period}}. Please share the document at your earliest. — {{firmName}}',
        variables: ['clientName', 'documentType', 'period', 'firmName'],
      },
      {
        key: 'deadline_nudge',
        name: 'Filing Deadline Nudge',
        body: 'Reminder: Your GST return for {{period}} is due on {{deadline}}. Please ensure all documents are submitted. — {{firmName}}',
        variables: ['period', 'deadline', 'firmName'],
      },
      {
        key: 'payment_received',
        name: 'Payment Received',
        body: 'Dear {{clientName}}, we confirm receipt of ₹{{amount}} towards {{invoiceRef}}. Thank you! — {{firmName}}',
        variables: ['clientName', 'amount', 'invoiceRef', 'firmName'],
      },
    ]

    await this.prisma.whatsAppTemplate.createMany({
      data: templates.map((t) => ({
        companyId,
        key: t.key,
        name: t.name,
        body: t.body,
        variables: t.variables,
      })),
      skipDuplicates: true,
    })
  }

  // ── Update tenant ────────────────────────────────────────────────────────────

  async updateTenant(id: string, dto: {
    name?: string
    subscriptionPlan?: string
    gstNumber?: string
    panNumber?: string
    phone?: string
    address?: string
    modulesEnabled?: string[]
  }) {
    const { modulesEnabled, ...fields } = dto
    const updateData: Record<string, unknown> = { ...fields }

    if (modulesEnabled) {
      const company = await this.prisma.company.findUnique({ where: { id } })
      if (!company) throw new NotFoundException('Tenant not found')
      const currentConfig = (company.tenantConfig as Record<string, unknown>) ?? {}
      updateData['tenantConfig'] = { ...currentConfig, modulesEnabled }
    }

    return this.prisma.company.update({ where: { id }, data: updateData as never })
  }

  // ── Deactivate tenant ────────────────────────────────────────────────────────

  async deactivateTenant(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } })
    if (!company) throw new NotFoundException('Tenant not found')
    await this.prisma.company.update({ where: { id }, data: { isActive: false } })
    return { ok: true }
  }

  // ── Client CSV import ────────────────────────────────────────────────────────

  async importClients(companyId: string, csvContent: string) {
    const lines = csvContent.split('\n').filter((l) => l.trim())
    if (lines.length < 2) throw new BadRequestException('CSV must have header + at least 1 data row')

    const headers = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const idx = (name: string) => headers.indexOf(name)

    let created = 0, updated = 0, skipped = 0
    const errors: Array<{ row: number; reason: string }> = []

    for (let i = 1; i < lines.length; i++) {
      const row = i + 1
      const raw = lines[i] ?? ''
      // Handle quoted CSV fields
      const cols = this.parseCsvRow(raw)

      const get = (name: string) => {
        const v = cols[idx(name)]
        return v ? v.trim() : undefined
      }

      const name = get('name')
      if (!name) { errors.push({ row, reason: 'name is required' }); skipped++; continue }

      const gstin = get('gstin')?.toUpperCase()
      const pan = get('pan')?.toUpperCase()
      const filerType = (get('filerType') ?? 'MONTHLY').toUpperCase()

      if (gstin && !GSTIN_REGEX.test(gstin)) {
        errors.push({ row, reason: `GSTIN format invalid: ${gstin}` }); skipped++; continue
      }
      if (pan && !PAN_REGEX.test(pan)) {
        errors.push({ row, reason: `PAN format invalid: ${pan}` }); skipped++; continue
      }
      if (!VALID_FILER_TYPES.includes(filerType)) {
        errors.push({ row, reason: `filerType must be MONTHLY|QUARTERLY|ANNUAL` }); skipped++; continue
      }

      const serviceScope = (get('serviceScope') ?? '').split(',').map((s) => s.trim()).filter(Boolean)

      try {
        // Find existing client by gstin (if set) or name
        const where = gstin
          ? { companyId_gstin: { companyId, gstin } }
          : undefined

        const existing = where
          ? await this.prisma.client.findUnique({ where })
          : await this.prisma.client.findFirst({ where: { companyId, name } })

        const data = {
          companyId,
          name,
          gstin: gstin ?? null,
          pan: pan ?? null,
          contactPerson: get('contactPerson') ?? null,
          phone: get('phone') ?? null,
          email: get('email') ?? null,
          filerType: filerType as never,
          serviceScope,
        }

        if (existing) {
          await this.prisma.client.update({ where: { id: existing.id }, data })
          updated++
        } else {
          await this.prisma.client.create({ data })
          created++
        }
      } catch {
        errors.push({ row, reason: 'Database error — possible duplicate GSTIN' })
        skipped++
      }
    }

    return { created, updated, skipped, errors }
  }

  private parseCsvRow(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  // ── Config ───────────────────────────────────────────────────────────────────

  async getTenantConfig(companyId: string) {
    const snapshot = await this.configSvc.getAll(companyId)
    return Object.entries(snapshot).map(([key, entry]) => ({ key, ...entry }))
  }

  async setTenantConfig(companyId: string, key: string, value: unknown) {
    // Find a system user or use a sentinel
    const user = await this.prisma.user.findFirst({ where: { companyId }, orderBy: { createdAt: 'asc' } })
    await this.configSvc.set(companyId, key as never, value, user?.id ?? 'admin')
    return { ok: true }
  }

  async resetTenantConfig(companyId: string, key: string) {
    await this.configSvc.reset(companyId, key as never)
    return { ok: true }
  }

  // ── System config ────────────────────────────────────────────────────────────

  async getSystemConfig() {
    const rows = await this.prisma.systemConfig.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] })
    return rows.map((r) => ({
      key: r.key,
      label: r.label,
      category: r.category,
      value: JSON.parse(r.value) as unknown,
      systemDefault: JSON.parse(r.value) as unknown,
      isOverridden: false,
      dataType: r.dataType,
      unit: r.unit,
      description: r.description,
      minValue: r.minValue ? JSON.parse(r.minValue) as unknown : null,
      maxValue: r.maxValue ? JSON.parse(r.maxValue) as unknown : null,
    }))
  }

  async updateSystemConfig(key: string, value: unknown) {
    await this.prisma.systemConfig.update({
      where: { key },
      data: { value: JSON.stringify(value) },
    })
    return { ok: true }
  }

  // ── Knowledge ────────────────────────────────────────────────────────────────

  async listKnowledge(companyId: string) {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { companyId },
      include: { _count: { select: { chunks: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return docs.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      chunkCount: d._count.chunks,
      createdAt: d.createdAt.toISOString(),
    }))
  }

  async createKnowledge(companyId: string, dto: { title: string; category: string; content: string }) {
    const doc = await this.knowledge.ingestDocument(companyId, {
      title: dto.title,
      category: dto.category as KnowledgeCategory,
      content: dto.content,
    })
    const chunkCount = await this.prisma.knowledgeChunk.count({ where: { documentId: doc.id } })
    return { id: doc.id, title: doc.title, category: doc.category, chunkCount, createdAt: doc.createdAt.toISOString() }
  }

  async deleteKnowledge(companyId: string, docId: string) {
    const doc = await this.prisma.knowledgeDocument.findFirst({ where: { id: docId, companyId } })
    if (!doc) throw new NotFoundException('Knowledge document not found')
    await this.prisma.knowledgeDocument.delete({ where: { id: docId } })
    return { ok: true }
  }

  // ── Impersonation ────────────────────────────────────────────────────────────

  async createImpersonation(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) throw new NotFoundException('Tenant not found')

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await this.prisma.impersonationToken.create({ data: { token, companyId, expiresAt } })

    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
    return {
      token,
      url: `${appUrl}/impersonate?token=${token}`,
    }
  }

  async verifyImpersonation(token: string) {
    const rec = await this.prisma.impersonationToken.findUnique({ where: { token } })
    if (!rec) throw new NotFoundException('Token not found')
    if (rec.expiresAt < new Date()) throw new BadRequestException('Token expired')
    if (rec.usedAt) throw new BadRequestException('Token already used')

    await this.prisma.impersonationToken.update({ where: { token }, data: { usedAt: new Date() } })

    const company = await this.prisma.company.findUnique({ where: { id: rec.companyId }, select: { id: true, name: true } })
    if (!company) throw new NotFoundException('Company not found')

    return { companyId: company.id, companyName: company.name }
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async getAuditLog(limit = 50, companyId?: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { company: { select: { name: true } }, user: { select: { name: true, email: true } } },
    })
    return logs.map((l) => ({
      id: l.id,
      companyId: l.companyId,
      companyName: l.company.name,
      userId: l.userId,
      userName: l.user.name,
      action: l.action,
      metadata: l.metadata as Record<string, unknown> | null,
      createdAt: l.createdAt.toISOString(),
    }))
  }
}
