import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'

export interface DocumentUploadedPayload {
  staffEmail: string
  staffName: string
  clientName: string
  documentType: string
  originalName: string
  filingPeriod?: string | null
  uploadedVia: 'staff' | 'client-link'
}

export interface OcrCompletePayload {
  staffEmail: string
  staffName: string
  clientName: string
  documentType: string
  originalName: string
  filingPeriod?: string | null
  status: 'PROCESSED' | 'NEEDS_REVIEW' | 'FAILED'
}

export interface DeadlineReminderPayload {
  staffEmail: string
  staffName: string
  overdue: Array<{ clientName: string; period: string; daysOverdue: number }>
  dueSoon: Array<{ clientName: string; period: string; daysRemaining: number }>
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private readonly resend: Resend | null
  private readonly fromAddress: string

  constructor() {
    const apiKey = process.env['RESEND_API_KEY']
    if (apiKey) {
      this.resend = new Resend(apiKey)
      this.logger.log('Email service ready (Resend)')
    } else {
      this.resend = null
      this.logger.warn('RESEND_API_KEY not set — email notifications disabled')
    }
    this.fromAddress = process.env['EMAIL_FROM'] ?? 'OpsCopilot <noreply@opsc.app>'
  }

  async sendDocumentUploaded(payload: DocumentUploadedPayload): Promise<void> {
    const subject = payload.uploadedVia === 'client-link'
      ? `📎 Client uploaded: ${payload.originalName}`
      : `Document uploaded: ${payload.originalName}`

    const html = `
      <p>Hi ${payload.staffName},</p>
      <p>A new document has been uploaded${payload.uploadedVia === 'client-link' ? ' by a client' : ''}.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Client</td><td style="font-size:14px">${payload.clientName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Document type</td><td style="font-size:14px">${payload.documentType.replace(/_/g, ' ')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">File name</td><td style="font-size:14px">${payload.originalName}</td></tr>
        ${payload.filingPeriod ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Filing period</td><td style="font-size:14px">${payload.filingPeriod}</td></tr>` : ''}
      </table>
      <p>Log in to review it: <a href="${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/documents">Open Documents</a></p>
    `
    await this.send(payload.staffEmail, subject, html)
  }

  async sendOcrComplete(payload: OcrCompletePayload): Promise<void> {
    const emoji = payload.status === 'PROCESSED' ? '✅' : payload.status === 'NEEDS_REVIEW' ? '⚠️' : '❌'
    const subject = `${emoji} OCR ${payload.status.replace(/_/g, ' ').toLowerCase()}: ${payload.originalName}`

    const statusMsg: Record<string, string> = {
      PROCESSED: 'processed successfully and is ready to review.',
      NEEDS_REVIEW: 'processed but has low confidence — please review manually.',
      FAILED: 'failed to process. Please re-upload or reprocess it.',
    }

    const html = `
      <p>Hi ${payload.staffName},</p>
      <p>The document <strong>${payload.originalName}</strong> has been ${statusMsg[payload.status]}</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Client</td><td style="font-size:14px">${payload.clientName}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Type</td><td style="font-size:14px">${payload.documentType.replace(/_/g, ' ')}</td></tr>
        ${payload.filingPeriod ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px">Filing period</td><td style="font-size:14px">${payload.filingPeriod}</td></tr>` : ''}
      </table>
      <p><a href="${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/documents">View in OpsCopilot →</a></p>
    `
    await this.send(payload.staffEmail, subject, html)
  }

  async sendDeadlineReminder(payload: DeadlineReminderPayload): Promise<void> {
    if (payload.overdue.length === 0 && payload.dueSoon.length === 0) return

    const total = payload.overdue.length + payload.dueSoon.length
    const subject = `⚠️ GST Filing Alert: ${total} client${total > 1 ? 's' : ''} need attention`

    const overdueRows = payload.overdue.map(
      (r) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${r.clientName}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${r.period}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;color:#dc2626">${Math.abs(r.daysOverdue)} day${Math.abs(r.daysOverdue) !== 1 ? 's' : ''} overdue</td></tr>`,
    ).join('')

    const dueSoonRows = payload.dueSoon.map(
      (r) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${r.clientName}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6">${r.period}</td><td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;color:#d97706">${r.daysRemaining} day${r.daysRemaining !== 1 ? 's' : ''} left</td></tr>`,
    ).join('')

    const html = `
      <p>Hi ${payload.staffName},</p>
      <p>Here is your daily GST filing status update:</p>
      ${payload.overdue.length > 0 ? `
        <h3 style="color:#dc2626;margin-top:24px">Overdue (${payload.overdue.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#fef2f2"><th style="padding:6px 8px;text-align:left">Client</th><th style="padding:6px 8px;text-align:left">Period</th><th style="padding:6px 8px;text-align:left">Status</th></tr></thead>
          <tbody>${overdueRows}</tbody>
        </table>` : ''}
      ${payload.dueSoon.length > 0 ? `
        <h3 style="color:#d97706;margin-top:24px">Due within 7 days (${payload.dueSoon.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#fffbeb"><th style="padding:6px 8px;text-align:left">Client</th><th style="padding:6px 8px;text-align:left">Period</th><th style="padding:6px 8px;text-align:left">Status</th></tr></thead>
          <tbody>${dueSoonRows}</tbody>
        </table>` : ''}
      <p style="margin-top:24px"><a href="${process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'}/filings">Open Filing Calendar →</a></p>
    `
    await this.send(payload.staffEmail, subject, html)
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`[Email skipped — no API key] To: ${to} | Subject: ${subject}`)
      return
    }
    try {
      const { error } = await this.resend.emails.send({ from: this.fromAddress, to, subject, html })
      if (error) this.logger.error(`Resend error: ${JSON.stringify(error)}`)
    } catch (err) {
      this.logger.error('Failed to send email', err)
    }
  }
}
