import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export const DEFAULT_TEMPLATES: Record<string, { name: string; body: string; variables: string[] }> = {
  fee_reminder: {
    name: 'Fee payment reminder',
    body: `Dear {{clientName}},

This is a reminder that your fee of ₹{{amount}} for {{servicePeriod}} is overdue by {{agingDays}} days.

Please arrange payment at your earliest convenience.

Regards,
{{firmName}}`,
    variables: ['clientName', 'amount', 'servicePeriod', 'agingDays', 'firmName'],
  },
  doc_request: {
    name: 'Document request',
    body: `Dear {{clientName}},

We require your {{documentType}} for the period {{period}} to complete your filing.

Please share the document by {{dueDate}}.

{{customMessage}}

Regards,
{{firmName}}`,
    variables: ['clientName', 'documentType', 'period', 'dueDate', 'customMessage', 'firmName'],
  },
  deadline_nudge: {
    name: 'GST filing deadline nudge',
    body: `Dear {{clientName}},

The GST filing deadline is {{daysUntilDeadline}} days away ({{deadlineDate}}).

We are still awaiting your {{pendingDocuments}} to complete the filing.

Please submit at the earliest.

Regards,
{{firmName}}`,
    variables: ['clientName', 'daysUntilDeadline', 'deadlineDate', 'pendingDocuments', 'firmName'],
  },
  payment_received: {
    name: 'Payment received acknowledgement',
    body: `Dear {{clientName}},

We have received your payment of ₹{{amount}} against invoice #{{invoiceNumber}}.

Thank you for your prompt payment.

Regards,
{{firmName}}`,
    variables: ['clientName', 'amount', 'invoiceNumber', 'firmName'],
  },

  // ── Inbound auto-reply templates ───────────────────────────────────────────

  inbound_ack: {
    name: 'Document received acknowledgement',
    body: `✅ Received {{count}} document{{plural}}. We'll process {{them}} and update you shortly.

— {{firmName}}`,
    variables: ['count', 'plural', 'them', 'firmName'],
  },

  inbound_text_ack: {
    name: 'Text message acknowledgement',
    body: `👋 Thanks for your message, {{clientName}}. To share documents please send them as an attachment.

— {{firmName}}`,
    variables: ['clientName', 'firmName'],
  },

  ocr_result_ack: {
    name: 'Document processing result',
    body: `{{statusEmoji}} Your {{docLabel}}{{periodPart}} has been {{statusMessage}}

— {{firmName}}`,
    variables: ['statusEmoji', 'docLabel', 'periodPart', 'statusMessage', 'firmName'],
  },

  payment_confirmation_ack: {
    name: 'Payment confirmation received',
    body: `Thank you, {{clientName}}! We've noted your payment confirmation and will verify it shortly.

If you have a payment reference or screenshot, please share it and we'll update the records promptly.

— {{firmName}}`,
    variables: ['clientName', 'firmName'],
  },

  promise_to_pay_ack: {
    name: 'Promise to pay acknowledgement',
    body: `Noted, {{clientName}}. We've recorded that you plan to pay by {{promiseDate}}.

Please reach out if you need any assistance.

— {{firmName}}`,
    variables: ['clientName', 'promiseDate', 'firmName'],
  },

  invoice_summary_reply: {
    name: 'Invoice summary reply',
    body: `Hi {{clientName}}, here's your outstanding balance:

Amount due: ₹{{amount}}
Invoice date: {{dueDate}}
Overdue by: {{agingDays}} days

Please arrange payment at your earliest convenience.

— {{firmName}}`,
    variables: ['clientName', 'amount', 'dueDate', 'agingDays', 'firmName'],
  },

  filing_status_reply: {
    name: 'Filing status reply',
    body: `Hi {{clientName}}, here's your current GST filing status:

Period: {{period}}
Deadline: {{deadline}}
Status: {{status}}

{{actionMessage}}

— {{firmName}}`,
    variables: ['clientName', 'period', 'deadline', 'status', 'actionMessage', 'firmName'],
  },

  greeting_reply: {
    name: 'Greeting reply',
    body: `Hello {{clientName}}! 👋

You can send us your GST returns, invoices, TDS certificates or any other documents directly on WhatsApp and we'll process them automatically.

For queries about your filings or payments, just ask!

— {{firmName}}`,
    variables: ['clientName', 'firmName'],
  },
}

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  interpolate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => variables[key] ?? match)
  }

  async getTemplate(companyId: string, key: string): Promise<{ body: string; name: string }> {
    const tmpl = await this.prisma.whatsAppTemplate.findUnique({
      where: { companyId_key: { companyId, key } },
    })
    if (tmpl) return { body: tmpl.body, name: tmpl.name }

    // Fall back to default
    const def = DEFAULT_TEMPLATES[key]
    if (!def) throw new NotFoundException(`Template not found: ${key}`)
    return def
  }

  async listTemplates(companyId: string) {
    const saved = await this.prisma.whatsAppTemplate.findMany({ where: { companyId } })
    const savedKeys = new Set(saved.map((t) => t.key))

    // Merge with defaults
    const defaults = Object.entries(DEFAULT_TEMPLATES)
      .filter(([k]) => !savedKeys.has(k))
      .map(([key, def]) => ({
        id: null as string | null,
        companyId,
        key,
        name: def.name,
        body: def.body,
        variables: def.variables,
        isActive: true,
        isDefault: true,
      }))

    return [
      ...saved.map((t) => ({ ...t, variables: t.variables as string[], isDefault: false })),
      ...defaults,
    ]
  }

  async updateTemplate(companyId: string, key: string, body: string) {
    const def = DEFAULT_TEMPLATES[key]
    if (!def) throw new NotFoundException(`Template key not found: ${key}`)
    return this.prisma.whatsAppTemplate.upsert({
      where: { companyId_key: { companyId, key } },
      update: { body },
      create: { companyId, key, name: def.name, body, variables: def.variables },
    })
  }

  async seedTemplatesForCompany(companyId: string) {
    for (const [key, def] of Object.entries(DEFAULT_TEMPLATES)) {
      await this.prisma.whatsAppTemplate.upsert({
        where: { companyId_key: { companyId, key } },
        update: {},
        create: { companyId, key, name: def.name, body: def.body, variables: def.variables },
      })
    }
  }
}
