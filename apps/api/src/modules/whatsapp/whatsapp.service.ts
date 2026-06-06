import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common'
import { AppException, WhatsAppSendFailedException, WhatsAppRateLimitException } from '../../common/exceptions'
import { PrismaService } from '../../prisma/prisma.service'
import { TwilioService } from './twilio.service'
import { TemplateService } from './template.service'
import { ConfigService } from '../config/config.service'
import { ConfigKey } from '../config/config-key.enum'
import { DocumentsService } from '../documents/documents.service'
import { FilingsService } from '../filings/filings.service'
import { classifyInboundMessage } from './inbound-classifier'
import type { OcrResult } from '../documents/documents.service'
import type { ListMessagesDto } from './dto/list-messages.dto'
import type { DocumentType } from '@opsc/database'
import type { AuthenticatedUser } from '@opsc/types'
import { getOwnedClientIds } from '../../common/helpers/client-scope.helper'

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly twilio: TwilioService,
    private readonly templates: TemplateService,
    private readonly configSvc: ConfigService,
    @Optional() private readonly documents: DocumentsService,
    @Optional() private readonly filings: FilingsService,
  ) {}

  // ─── Fee Reminder ──────────────────────────────────────────────────────────

  async sendFeeReminder(invoiceId: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        customerName: true,
        customerPhone: true,
        amount: true,
        dueDate: true,
        agingDays: true,
        company: { select: { name: true } },
      },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')
    if (!invoice.customerPhone) throw new NotFoundException('Customer phone not set on invoice')

    const { body } = await this.templates.getTemplate(companyId, 'fee_reminder')
    const rendered = this.templates.interpolate(body, {
      clientName: invoice.customerName,
      amount: Number(invoice.amount).toLocaleString('en-IN'),
      servicePeriod: fmtMonthYear(invoice.dueDate),
      agingDays: String(invoice.agingDays),
      firmName: invoice.company.name,
    })
    return this.dispatchMessage(companyId, invoice.customerPhone, rendered, 'fee_reminder')
  }

  // ─── Document Request ───────────────────────────────────────────────────────

  async sendDocumentRequest(documentRequestId: string, companyId: string) {
    const req = await this.prisma.documentRequest.findFirst({
      where: { id: documentRequestId, companyId },
      include: {
        requestedFromUser: { select: { name: true } },
        company: { select: { name: true } },
      },
    })
    if (!req) throw new NotFoundException('Document request not found')

    const userInvoice = await this.prisma.invoice.findFirst({
      where: { companyId, customerName: req.requestedFromUser.name },
      select: { customerPhone: true },
    })
    const phone = userInvoice?.customerPhone
    if (!phone) throw new NotFoundException('No phone number found for document request recipient')

    const { body } = await this.templates.getTemplate(companyId, 'doc_request')
    const rendered = this.templates.interpolate(body, {
      clientName: req.requestedFromUser.name,
      documentType: req.documentType.replace(/_/g, ' '),
      period: fmtMonthYear(new Date()),
      dueDate: req.dueDate ? fmtDate(req.dueDate) : 'ASAP',
      customMessage: req.notes ?? '',
      firmName: req.company.name,
    })
    return this.dispatchMessage(companyId, phone, rendered, 'doc_request')
  }

  // ─── Deadline Nudge ─────────────────────────────────────────────────────────

  async sendDeadlineNudge(companyId: string) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { name: true },
    })

    const invoices = await this.prisma.invoice.findMany({
      where: { companyId, status: 'OVERDUE', customerPhone: { not: null } },
      select: { id: true, customerName: true, customerPhone: true, dueDate: true, agingDays: true },
      take: 50,
    })

    const { body } = await this.templates.getTemplate(companyId, 'deadline_nudge')
    const results = await Promise.allSettled(
      invoices.map((inv) => {
        const rendered = this.templates.interpolate(body, {
          clientName: inv.customerName,
          daysUntilDeadline: String(Math.max(0, -inv.agingDays)),
          deadlineDate: fmtDate(inv.dueDate),
          pendingDocuments: 'required documents',
          firmName: company.name,
        })
        return this.dispatchMessage(companyId, inv.customerPhone!, rendered, 'deadline_nudge')
      }),
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    return { sent, failed, total: invoices.length }
  }

  // ─── Payment Acknowledgement ────────────────────────────────────────────────

  async sendPaymentAck(invoiceId: string, companyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true, customerName: true, customerPhone: true,
        amount: true, company: { select: { name: true } },
      },
    })
    if (!invoice) throw new NotFoundException('Invoice not found')
    if (!invoice.customerPhone) throw new NotFoundException('Customer phone not set')

    const { body } = await this.templates.getTemplate(companyId, 'payment_received')
    const rendered = this.templates.interpolate(body, {
      clientName: invoice.customerName,
      amount: Number(invoice.amount).toLocaleString('en-IN'),
      invoiceNumber: invoiceId.slice(-8).toUpperCase(),
      firmName: invoice.company.name,
    })
    return this.dispatchMessage(companyId, invoice.customerPhone, rendered, 'payment_received')
  }

  // ─── List Messages ──────────────────────────────────────────────────────────

  async listMessages(user: AuthenticatedUser, filters: ListMessagesDto) {
    const companyId = user.companyId
    const { page = 1, limit = 20, status, direction } = filters

    const ownedIds = await getOwnedClientIds(user, this.prisma)
    const clientScopeFilter = ownedIds !== null ? { clientId: { in: ownedIds } } : {}

    const where = {
      companyId,
      ...clientScopeFilter,
      ...(status ? { status } : {}),
      ...(direction ? { direction } : {}),
    }
    const [total, messages] = await Promise.all([
      this.prisma.whatsAppMessage.count({ where }),
      this.prisma.whatsAppMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])
    return { data: messages, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
  }

  // ─── Stats ──────────────────────────────────────────────────────────────────

  async getStats(companyId: string) {
    const [total, sent, delivered, failed, read] = await Promise.all([
      this.prisma.whatsAppMessage.count({ where: { companyId } }),
      this.prisma.whatsAppMessage.count({ where: { companyId, status: 'SENT' } }),
      this.prisma.whatsAppMessage.count({ where: { companyId, status: 'DELIVERED' } }),
      this.prisma.whatsAppMessage.count({ where: { companyId, status: 'FAILED' } }),
      this.prisma.whatsAppMessage.count({ where: { companyId, status: 'READ' } }),
    ])
    const byTemplate = await this.prisma.whatsAppMessage.groupBy({
      by: ['templateKey'],
      where: { companyId },
      _count: { id: true },
    })
    return {
      total, sent, delivered, failed, read,
      deliveryRate: total > 0 ? Math.round(((delivered + read) / total) * 100) : 0,
      byTemplate: byTemplate.map((t) => ({ key: t.templateKey, count: t._count.id })),
    }
  }

  // ─── Webhook: Twilio status callback ───────────────────────────────────────

  async handleStatusCallback(data: Record<string, string>) {
    const sid = data['MessageSid']
    const status = (data['MessageStatus'] ?? '').toUpperCase()
    if (!sid) return

    const statusMap: Record<string, string> = {
      SENT: 'SENT', DELIVERED: 'DELIVERED', READ: 'READ',
      FAILED: 'FAILED', UNDELIVERED: 'FAILED',
    }
    const mapped = statusMap[status] ?? 'SENT'

    await this.prisma.whatsAppMessage.updateMany({
      where: { twilioSid: sid },
      data: {
        status: mapped as 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
        ...(mapped === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(mapped === 'FAILED' ? { failedAt: new Date(), errorMessage: data['ErrorMessage'] } : {}),
      },
    })
  }

  // ─── Handle inbound WhatsApp message ───────────────────────────────────────
  //
  // Full pipeline:
  //   1. Normalise phone
  //   2. Resolve companyId → clientId
  //   3. Log inbound message
  //   4. If media → download → OCR → WA notify on completion
  //   5. If text → classify intent → route to handler → send contextual reply

  async handleInbound(data: Record<string, string>): Promise<void> {
    const rawFrom   = data['From'] ?? ''
    const rawTo     = data['To'] ?? ''
    const body      = data['Body'] ?? ''
    const twilioSid = data['MessageSid'] ?? `inbound_${Date.now()}`
    const numMedia  = parseInt(data['NumMedia'] ?? '0', 10)

    const fromPhone = rawFrom.replace(/^whatsapp:/i, '')
    const toPhone   = rawTo.replace(/^whatsapp:/i, '')

    // ── 1. Resolve company ──────────────────────────────────────────────────
    const companyId = await this.resolveCompanyFromPhone(fromPhone)
    if (!companyId) {
      this.logger.warn(`Inbound WA from unknown phone ${fromPhone} — no matching company`)
      return
    }

    // ── 2. Resolve client ───────────────────────────────────────────────────
    const clientId = await this.resolveClientFromPhone(fromPhone, companyId)

    // ── 3. Classify intent (for text messages) ──────────────────────────────
    const classification = numMedia === 0 && body.trim()
      ? classifyInboundMessage(body)
      : null

    // ── 4. Log inbound message ──────────────────────────────────────────────
    await this.prisma.whatsAppMessage.create({
      data: {
        companyId,
        clientId: clientId ?? undefined,
        direction: 'INBOUND',
        templateKey: classification ? `inbound_${classification.intent.toLowerCase()}` : 'inbound_media',
        fromPhone,
        toPhone,
        body: body || (numMedia > 0 ? `[${numMedia} attachment(s)]` : ''),
        status: 'DELIVERED',
        twilioSid,
        sentAt: new Date(),
        deliveredAt: new Date(),
        metadata: {
          ...(numMedia > 0 ? { numMedia } : {}),
          ...(classification ? { intent: classification.intent, promiseDate: classification.promiseDate } : {}),
        },
      },
    })

    // ── 5. Process media ────────────────────────────────────────────────────
    if (numMedia > 0 && this.documents) {
      const saved = await this.processInboundMedia(data, companyId, clientId, fromPhone, body)
      if (saved > 0) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
        const { body: tpl } = await this.templates.getTemplate(companyId, 'inbound_ack')
        const ackBody = this.templates.interpolate(tpl, {
          count: String(saved),
          plural: saved > 1 ? 's' : '',
          them: saved > 1 ? 'them' : 'it',
          firmName: company?.name ?? 'Your CA',
        })
        await this.dispatchMessage(companyId, fromPhone, ackBody, 'inbound_ack')
      }
      return
    }

    // ── 6. Route text intents ───────────────────────────────────────────────
    if (classification) {
      await this.routeTextIntent(classification.intent, classification.promiseDate, fromPhone, companyId, clientId, body)
    }
  }

  // ─── Route classified text intent to the right handler ─────────────────────

  private async routeTextIntent(
    intent: ReturnType<typeof classifyInboundMessage>['intent'],
    promiseDate: string | null,
    fromPhone: string,
    companyId: string,
    clientId: string | null,
    originalBody: string,
  ): Promise<void> {
    switch (intent) {
      case 'PAYMENT_CONFIRMATION':
        await this.handlePaymentConfirmation(fromPhone, companyId, clientId)
        break
      case 'PROMISE_TO_PAY':
        await this.handlePromiseToPay(fromPhone, companyId, clientId, promiseDate ?? 'soon')
        break
      case 'INVOICE_QUERY':
        await this.handleInvoiceQuery(fromPhone, companyId, clientId)
        break
      case 'FILING_STATUS_QUERY':
        await this.handleFilingStatusQuery(fromPhone, companyId, clientId)
        break
      case 'DOCUMENT_SENT_CONFIRM':
        await this.handleDocumentSentConfirm(fromPhone, companyId, clientId)
        break
      case 'GREETING':
        await this.handleGreeting(fromPhone, companyId, clientId)
        break
      default:
        await this.handleUnknown(fromPhone, companyId, clientId)
    }
  }

  // ─── Intent handlers ────────────────────────────────────────────────────────

  private async handlePaymentConfirmation(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })

    // Flag all open invoices for this client for staff review
    if (clientId) {
      await this.prisma.invoice.updateMany({
        where: { companyId, clientId, status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] } },
        data: { status: 'PARTIAL' }, // Flag as partial until staff confirms full payment
      })
    }

    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)
    const { body } = await this.templates.getTemplate(companyId, 'payment_confirmation_ack')
    const rendered = this.templates.interpolate(body, {
      clientName,
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'payment_confirmation_ack')

    this.logger.log(`Payment confirmation received from ${fromPhone} (client: ${clientId ?? 'unknown'}) — invoices flagged for review`)
  }

  private async handlePromiseToPay(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
    promiseDate: string,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    const { body } = await this.templates.getTemplate(companyId, 'promise_to_pay_ack')
    const rendered = this.templates.interpolate(body, {
      clientName,
      promiseDate,
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'promise_to_pay_ack')

    this.logger.log(`Promise to pay by "${promiseDate}" from ${fromPhone} (client: ${clientId ?? 'unknown'})`)
  }

  private async handleInvoiceQuery(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    // Find the most recent open invoice for this client
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        companyId,
        ...(clientId ? { clientId } : { customerPhone: { endsWith: fromPhone.replace(/\D/g, '').slice(-10) } }),
        status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
      },
      orderBy: { agingDays: 'desc' },
    })

    if (!invoice) {
      await this.dispatchMessage(
        companyId, fromPhone,
        `Hi ${clientName}! You have no outstanding invoices with us at the moment. — ${company?.name ?? 'Your CA'}`,
        'inbound_text_ack',
      )
      return
    }

    const { body } = await this.templates.getTemplate(companyId, 'invoice_summary_reply')
    const rendered = this.templates.interpolate(body, {
      clientName,
      amount: Number(invoice.amount).toLocaleString('en-IN'),
      dueDate: fmtDate(invoice.dueDate),
      agingDays: String(invoice.agingDays),
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'invoice_summary_reply')
  }

  private async handleFilingStatusQuery(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    if (!clientId || !this.filings) {
      await this.dispatchMessage(
        companyId, fromPhone,
        `Hi ${clientName}! We couldn't find your filing records. Please contact us directly for your GST status. — ${company?.name ?? 'Your CA'}`,
        'inbound_text_ack',
      )
      return
    }

    // Get the calendar row for this specific client
    const rows = await this.filings.getCalendar(companyId)
    const row = rows.find((r) => r.client.id === clientId)

    if (!row) {
      await this.dispatchMessage(
        companyId, fromPhone,
        `Hi ${clientName}! No filing records found for your account. Please reach out to us directly. — ${company?.name ?? 'Your CA'}`,
        'inbound_text_ack',
      )
      return
    }

    const statusEmoji = row.status === 'FILED' ? '✅' : row.status === 'OVERDUE' ? '❌' : '⏳'
    const actionMessage =
      row.status === 'FILED'
        ? 'Your filing is complete. No action needed.'
        : row.status === 'OVERDUE'
          ? 'Your filing is overdue. Please share your documents immediately.'
          : `Deadline is ${row.daysRemaining} day${row.daysRemaining !== 1 ? 's' : ''} away. Please share your documents soon.`

    const { body } = await this.templates.getTemplate(companyId, 'filing_status_reply')
    const rendered = this.templates.interpolate(body, {
      clientName,
      period: row.period,
      deadline: row.deadline,
      status: `${statusEmoji} ${row.status}`,
      actionMessage,
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'filing_status_reply')
  }

  private async handleDocumentSentConfirm(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    await this.dispatchMessage(
      companyId, fromPhone,
      `Got it, ${clientName}! We'll check for your document and process it. If we don't receive it, we'll follow up shortly. — ${company?.name ?? 'Your CA'}`,
      'inbound_text_ack',
    )
  }

  private async handleGreeting(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    const { body } = await this.templates.getTemplate(companyId, 'greeting_reply')
    const rendered = this.templates.interpolate(body, {
      clientName,
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'greeting_reply')
  }

  private async handleUnknown(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
    const clientName = await this.resolveClientName(fromPhone, companyId, clientId)

    const { body } = await this.templates.getTemplate(companyId, 'inbound_text_ack')
    const rendered = this.templates.interpolate(body, {
      clientName,
      firmName: company?.name ?? 'Your CA',
    })
    await this.dispatchMessage(companyId, fromPhone, rendered, 'inbound_text_ack')
  }

  // ─── Download + save each Twilio media item ─────────────────────────────────

  private async processInboundMedia(
    data: Record<string, string>,
    companyId: string,
    clientId: string | null,
    fromPhone: string,
    messageBody: string,
  ): Promise<number> {
    const numMedia = parseInt(data['NumMedia'] ?? '0', 10)
    const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']

    const uploader = await this.prisma.user.findFirst({
      where: { companyId, role: { in: ['ADMIN', 'OPERATIONS_MANAGER'] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    if (!uploader) {
      this.logger.error(`No admin user for company ${companyId} — cannot save inbound docs`)
      return 0
    }

    let saved = 0

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl    = data[`MediaUrl${i}`]
      const contentType = (data[`MediaContentType${i}`] ?? 'application/octet-stream')
        .split(';')[0]!.trim()

      if (!mediaUrl) continue
      if (!ALLOWED_TYPES.some((t) => contentType.startsWith(t))) {
        this.logger.warn(`Inbound media ${i} has unsupported type "${contentType}" — skipping`)
        continue
      }

      try {
        const buffer      = await this.twilio.downloadMedia(mediaUrl)
        const ext         = this.mimeToExt(contentType)
        const originalName = `whatsapp_${fromPhone.replace(/\D/g, '')}_${Date.now()}${ext}`

        const { key, sizeBytes } = await this.documents['storage'].save(
          buffer, originalName, contentType, companyId,
        )

        const documentType = this.inferDocumentType(messageBody, contentType)

        const document = await this.prisma.document.create({
          data: {
            companyId,
            uploadedById: uploader.id,
            clientId: clientId ?? undefined,
            documentType,
            status: 'UPLOADED',
            originalName,
            storageKey: key,
            fileSizeBytes: sizeBytes,
            mimeType: contentType,
            notes: `Auto-received via WhatsApp from ${fromPhone}${messageBody ? ` — "${messageBody.slice(0, 100)}"` : ''}`,
            sourceChannel: 'WHATSAPP_INBOUND' as any,
            sourceModule: 'DOCUMENTS',
            documentOwner: 'CLIENT' as any,
            documentPurpose: 'TAX_PREPARATION' as any,
            classificationSource: 'CHANNEL_INFERRED',
            classificationMode: 'SMART' as any,
          },
        })

        // OCR + WA notify on completion
        this.documents.processOcr(document.id, companyId)
          .then((result) => this.notifyOcrResultViaWhatsApp(fromPhone, companyId, result))
          .catch((err: unknown) => {
            this.logger.error(`OCR failed for inbound WA doc ${document.id}`, err)
          })

        saved++
      } catch (err) {
        this.logger.error(`Failed to process media item ${i} from ${fromPhone}`, err)
      }
    }

    return saved
  }

  // ─── OCR completion notification ────────────────────────────────────────────

  private async notifyOcrResultViaWhatsApp(
    fromPhone: string,
    companyId: string,
    result: OcrResult,
  ): Promise<void> {
    try {
      const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
      const firmName = company?.name ?? 'Your CA'
      const docLabel = result.documentType.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())

      let statusEmoji: string
      let statusMessage: string

      if (result.status === 'PROCESSED') {
        statusEmoji = '✅'
        statusMessage = `received and processed successfully. We'll be in touch if anything is needed.`
      } else if (result.status === 'NEEDS_REVIEW') {
        statusEmoji = '⚠️'
        statusMessage = `received but needs a quick review by our team. We'll follow up shortly.`
      } else {
        statusEmoji = '❌'
        statusMessage = `unclear — please send a clearer scan or PDF and we'll process it again.`
      }

      const periodPart = result.filingPeriod ? ` for ${result.filingPeriod}` : ''

      const { body } = await this.templates.getTemplate(companyId, 'ocr_result_ack')
      const rendered = this.templates.interpolate(body, {
        statusEmoji,
        docLabel,
        periodPart,
        statusMessage,
        firmName,
      })
      await this.dispatchMessage(companyId, fromPhone, rendered, 'ocr_result_ack')
    } catch (err) {
      this.logger.error(`Failed to send OCR result notification to ${fromPhone}`, err)
    }
  }

  // ─── Resolve helpers ─────────────────────────────────────────────────────────

  private async resolveCompanyFromPhone(phone: string): Promise<string | null> {
    const stripped = phone.replace(/\D/g, '').slice(-10)

    const recentOut = await this.prisma.whatsAppMessage.findFirst({
      where: { direction: 'OUTBOUND', toPhone: { endsWith: stripped } },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (recentOut) return recentOut.companyId

    const invoice = await this.prisma.invoice.findFirst({
      where: { customerPhone: { endsWith: stripped } },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (invoice) return invoice.companyId

    const client = await this.prisma.client.findFirst({
      where: { phone: { endsWith: stripped } },
      select: { companyId: true },
    })
    return client?.companyId ?? null
  }

  private async resolveClientFromPhone(phone: string, companyId: string): Promise<string | null> {
    const stripped = phone.replace(/\D/g, '').slice(-10)

    const client = await this.prisma.client.findFirst({
      where: { companyId, phone: { endsWith: stripped } },
      select: { id: true },
    })
    if (client) return client.id

    const invoice = await this.prisma.invoice.findFirst({
      where: { companyId, customerPhone: { endsWith: stripped }, clientId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { clientId: true },
    })
    return invoice?.clientId ?? null
  }

  private async resolveClientName(
    fromPhone: string,
    companyId: string,
    clientId: string | null,
  ): Promise<string> {
    if (clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { name: true } })
      if (client) return client.name
    }
    const stripped = fromPhone.replace(/\D/g, '').slice(-10)
    const invoice = await this.prisma.invoice.findFirst({
      where: { companyId, customerPhone: { endsWith: stripped } },
      orderBy: { createdAt: 'desc' },
      select: { customerName: true },
    })
    return invoice?.customerName ?? 'there'
  }

  private inferDocumentType(body: string, mimeType: string): DocumentType {
    const lower = body.toLowerCase()
    if (lower.includes('gstr') || lower.includes('gst return') || lower.includes('gst filing')) return 'GST_RETURN'
    if (lower.includes('tds') || lower.includes('form 16') || lower.includes('26as')) return 'TDS_CERTIFICATE'
    if (lower.includes('invoice') || lower.includes('bill') || lower.includes('tax invoice')) return 'INVOICE'
    if (lower.includes('bank') || lower.includes('statement') || lower.includes('passbook')) return 'BANK_STATEMENT'
    if (lower.includes('purchase order') || lower.includes('po ')) return 'PURCHASE_ORDER'
    if (lower.includes('delivery') || lower.includes('challan')) return 'DELIVERY_NOTE'
    return 'OTHER'
  }

  private mimeToExt(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    }
    return map[mimeType] ?? '.bin'
  }

  // ─── Dispatch helper ─────────────────────────────────────────────────────────

  private async isInQuietHours(companyId: string): Promise<boolean> {
    const [start, end] = await Promise.all([
      this.configSvc.getNum(companyId, ConfigKey.WHATSAPP_QUIET_HOURS_START).catch(() => 22),
      this.configSvc.getNum(companyId, ConfigKey.WHATSAPP_QUIET_HOURS_END).catch(() => 8),
    ])
    const hour = new Date().getHours()
    if (start < end) return hour >= start && hour < end
    return hour >= start || hour < end // wraps midnight
  }

  private async checkDailyLimit(companyId: string): Promise<void> {
    const limit = await this.configSvc.getNum(companyId, ConfigKey.WHATSAPP_DAILY_MESSAGE_LIMIT).catch(() => 100)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const count = await this.prisma.whatsAppMessage.count({
      where: { companyId, direction: 'OUTBOUND', createdAt: { gte: today } },
    })
    if (count >= limit) throw new WhatsAppRateLimitException()
  }

  private async dispatchMessage(companyId: string, toPhone: string, body: string, templateKey: string) {
    await this.checkDailyLimit(companyId)
    const inQuiet = await this.isInQuietHours(companyId)
    const record = await this.prisma.whatsAppMessage.create({
      data: {
        companyId, direction: 'OUTBOUND', toPhone, templateKey, body,
        status: inQuiet ? 'QUEUED' : 'QUEUED',
        ...(inQuiet ? {} : {}),
      },
    })
    if (inQuiet) {
      this.logger.log(`WhatsApp to ${toPhone} deferred — outside quiet hours`)
      return record
    }
    try {
      const { sid } = await this.twilio.sendWhatsApp(toPhone, body)
      return this.prisma.whatsAppMessage.update({
        where: { id: record.id },
        data: { status: 'SENT', twilioSid: sid, sentAt: new Date() },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Failed to send WhatsApp to ${toPhone}: ${msg}`)
      await this.prisma.whatsAppMessage.update({
        where: { id: record.id },
        data: { status: 'FAILED', failedAt: new Date(), errorMessage: msg },
      })
      if (err instanceof AppException) throw err
      const twilioErr = err as { code?: number; status?: number }
      if (twilioErr.code === 20429 || twilioErr.status === 429) {
        throw new WhatsAppRateLimitException()
      }
      // Resolve recipient name for the error message
      const clientName = toPhone
      throw new WhatsAppSendFailedException(clientName, msg)
    }
  }
}
