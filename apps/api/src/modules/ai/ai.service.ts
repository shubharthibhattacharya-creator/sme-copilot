import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import type { DocumentBlockParam } from '@anthropic-ai/sdk/resources/messages/messages'
import { AppException, AiServiceUnavailableException } from '../../common/exceptions'
import { PrismaService } from '../../prisma/prisma.service'
import type { TenantConfig, DashboardSummary } from '@opsc/types'
import type { AIModule, DocumentType } from '@opsc/database'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly anthropic = new Anthropic({
    apiKey: process.env['ANTHROPIC_API_KEY'],
  })
  private readonly model = process.env['ANTHROPIC_MODEL'] ?? 'claude-sonnet-4-6'

  constructor(private readonly prisma: PrismaService) {}

  async listInsights(companyId: string, module?: string) {
    return this.prisma.aIInsight.findMany({
      where: {
        companyId,
        ...(module ? { module: module as AIModule } : {}),
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    })
  }

  async generateInsights(companyId: string, module: AIModule) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    })

    const tenantConfig = company.tenantConfig as unknown as TenantConfig
    const persona = tenantConfig.aiPersona ?? 'collections-focused'

    const dataSnapshot = await this.buildDataSnapshot(companyId, module)
    const systemPrompt = this.buildSystemPrompt(persona, company.industry)

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Generate 3 actionable business insights for the ${module} module based on this data:\n\n${JSON.stringify(dataSnapshot, null, 2)}`,
          },
        ],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('insights', errMsg)
    }

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''

    const insight = await this.prisma.aIInsight.create({
      data: {
        companyId,
        module,
        category: module.toLowerCase(),
        severity: 'INFO',
        summary: text,
        dataSnapshot: JSON.parse(JSON.stringify(dataSnapshot)),
      },
    })

    return insight
  }

  async chat(
    companyId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  ) {
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    })

    const tenantConfig = company.tenantConfig as unknown as TenantConfig
    const systemPrompt = this.buildSystemPrompt(
      tenantConfig.aiPersona ?? 'collections-focused',
      company.industry,
    )

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages,
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('AI Assistant', errMsg)
    }

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return { reply }
  }

  private buildSystemPrompt(
    persona: TenantConfig['aiPersona'],
    industry: string,
  ): string {
    const focus: Record<TenantConfig['aiPersona'], string> = {
      'collections-focused':
        'You are an expert collections advisor for Indian SMEs. Focus on receivables, payment recovery, and cash flow.',
      'inventory-focused':
        'You are an expert supply chain advisor for Indian manufacturers. Focus on stock levels, reorder planning, and cost optimization.',
      'compliance-focused':
        'You are an expert CA and compliance advisor for Indian businesses. Focus on GST, TDS, and statutory obligations.',
    }

    return `${focus[persona]} You are serving a ${industry.replace('_', ' ').toLowerCase()} business. Provide concise, actionable advice in English. Always quantify recommendations where possible.`
  }

  private async buildDataSnapshot(companyId: string, module: AIModule): Promise<object> {
    if (module === 'COLLECTIONS') {
      const [total, overdue, pending] = await Promise.all([
        this.prisma.invoice.count({ where: { companyId } }),
        this.prisma.invoice.count({ where: { companyId, status: 'OVERDUE' } }),
        this.prisma.invoice.aggregate({
          where: { companyId, status: { in: ['PENDING', 'OVERDUE'] } },
          _sum: { amount: true },
        }),
      ])
      return { totalInvoices: total, overdueCount: overdue, pendingAmount: pending._sum.amount }
    }

    if (module === 'INVENTORY') {
      const lowStock = await this.prisma.inventoryItem.count({
        where: {
          companyId,
          quantity: { lte: 0 },
        },
      })
      const total = await this.prisma.inventoryItem.count({ where: { companyId } })
      return { totalItems: total, outOfStock: lowStock }
    }

    return {}
  }

  async extractDocumentData(
    base64Content: string,
    mimeType: string,
    documentType: DocumentType,
  ): Promise<Record<string, unknown>> {
    const systemPrompt = `You are a document data extraction specialist for Indian CA firms.
Extract structured data from the provided document.
Return ONLY a valid JSON object. No markdown, no explanation.

For INVOICE extract: { "documentType": "INVOICE", "invoiceNumber": string|null, "invoiceDate": "YYYY-MM-DD"|null, "clientName": string|null, "vendorName": string|null, "amount": number|null, "gstAmount": number|null, "totalAmount": number|null, "gstNumber": string|null, "panNumber": string|null, "confidence": number }
For CLIENT_SALES_INVOICE extract: { "documentType": "CLIENT_SALES_INVOICE", "invoiceNumber": string|null, "invoiceDate": "YYYY-MM-DD"|null, "sellerName": string|null, "sellerGstin": string|null, "buyerName": string|null, "buyerGstin": string|null, "amount": number|null, "gstAmount": number|null, "totalAmount": number|null, "igst": number|null, "cgst": number|null, "sgst": number|null, "confidence": number }
For CLIENT_PURCHASE_INVOICE extract: { "documentType": "CLIENT_PURCHASE_INVOICE", "invoiceNumber": string|null, "invoiceDate": "YYYY-MM-DD"|null, "vendorName": string|null, "vendorGstin": string|null, "buyerName": string|null, "buyerGstin": string|null, "amount": number|null, "gstAmount": number|null, "totalAmount": number|null, "igst": number|null, "cgst": number|null, "sgst": number|null, "confidence": number }
For GST_RETURN extract: { "documentType": "GST_RETURN", "gstNumber": string|null, "filingPeriod": string|null, "totalTaxableValue": number|null, "totalIGST": number|null, "totalCGST": number|null, "totalSGST": number|null, "filingDate": "YYYY-MM-DD"|null, "confidence": number }
For TDS_CERTIFICATE extract: { "documentType": "TDS_CERTIFICATE", "deductorName": string|null, "deducteeName": string|null, "panOfDeductee": string|null, "assessmentYear": string|null, "totalAmountPaid": number|null, "totalTaxDeducted": number|null, "confidence": number }
For OTHER documents extract whatever structured fields you can identify.
Always include a confidence score (0-1). Return null for fields you cannot determine.`

    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf'

    const contentBlocks: Anthropic.MessageParam['content'] = isImage
      ? [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Content,
            },
          } satisfies Anthropic.ImageBlockParam,
          {
            type: 'text' as const,
            text: `Extract data from this ${documentType} document.`,
          } satisfies Anthropic.TextBlockParam,
        ]
      : isPdf
        ? [
            {
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: 'application/pdf' as const,
                data: base64Content,
              },
            } satisfies DocumentBlockParam,
            {
              type: 'text' as const,
              text: `Extract data from this ${documentType} document.`,
            } satisfies Anthropic.TextBlockParam,
          ]
        : [
            {
              type: 'text' as const,
              text: `Extract data from this ${documentType} document. Return the JSON with all fields set to null and confidence: 0 as the file format is not supported.`,
            } satisfies Anthropic.TextBlockParam,
          ]

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('overloaded') || (err as { status?: number }).status === 529) {
        throw new AiServiceUnavailableException('document extraction', errMsg)
      }
      throw new AiServiceUnavailableException('document extraction', errMsg)
    }

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      this.logger.warn('Failed to parse OCR JSON', cleaned.slice(0, 200))
      return { confidence: 0, error: 'Parse failed', raw: cleaned.slice(0, 500) }
    }
  }

  /**
   * Cheap text-only Claude call — interprets structured text extracted by Document AI Layout Parser.
   * No vision required; used for GST returns after table structure has been extracted.
   */
  async extractFromStructuredText(
    structuredText: string,
    documentType: DocumentType,
  ): Promise<Record<string, unknown>> {
    const systemPrompt = `You are a document data extraction specialist for Indian CA firms.
You are given pre-extracted structured text (tables, rows) from a ${documentType} document.
Extract the key fields and return ONLY a valid JSON object. No markdown, no explanation.
Include a confidence score (0-1). Return null for fields you cannot determine.

For GST_RETURN extract: { "gstrType": "GSTR-1"|"GSTR-3B"|"GSTR-2B"|"GSTR-9"|null, "filingPeriod": string|null, "vendorGstin": string|null, "totalOutwardSupply": number|null, "taxableTurnover": number|null, "itcClaimed": number|null, "netTaxPayable": number|null, "totalTaxLiability": number|null, "confidence": number }
For TDS_CERTIFICATE extract: { "vendorName": string|null, "pan": string|null, "taxableAmount": number|null, "totalTax": number|null, "filingPeriod": string|null, "confidence": number }
For FINANCIAL_STATEMENT extract: { "vendorName": string|null, "totalAmount": number|null, "filingPeriod": string|null, "confidence": number }
For any other type extract whatever structured fields are present.`

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Extract structured data from this ${documentType} text:\n\n${structuredText.slice(0, 8000)}`,
          },
        ],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('structured text extraction', errMsg)
    }

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      return JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      this.logger.warn('Failed to parse structured text extraction JSON', cleaned.slice(0, 200))
      return { confidence: 0 }
    }
  }

  /**
   * Targeted field-level Claude vision call.
   * Only asks Claude to extract specific uncertain fields, not the full document.
   * ~3-5x cheaper than a full vision call when only a few fields are uncertain.
   */
  async extractSpecificFields(
    base64Content: string,
    mimeType: string,
    documentType: DocumentType,
    fields: string[],
  ): Promise<Record<string, unknown>> {
    const fieldList = fields.join(', ')
    const systemPrompt = `You are a document data extraction specialist.
Extract ONLY these specific fields from the document: ${fieldList}.
Return ONLY a valid JSON object with those field names as keys. No markdown, no explanation.
Include confidence (0-1). Return null for fields you cannot find.`

    const isImage = mimeType.startsWith('image/')
    const isPdf = mimeType === 'application/pdf'

    const contentBlocks: Anthropic.MessageParam['content'] = isImage
      ? [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Content,
            },
          } satisfies Anthropic.ImageBlockParam,
          {
            type: 'text' as const,
            text: `Extract these fields from this ${documentType}: ${fieldList}`,
          } satisfies Anthropic.TextBlockParam,
        ]
      : isPdf
        ? [
            {
              type: 'document' as const,
              source: {
                type: 'base64' as const,
                media_type: 'application/pdf' as const,
                data: base64Content,
              },
            } satisfies DocumentBlockParam,
            {
              type: 'text' as const,
              text: `Extract these fields from this ${documentType}: ${fieldList}`,
            } satisfies Anthropic.TextBlockParam,
          ]
        : [
            {
              type: 'text' as const,
              text: `Cannot extract from this format. Return all fields as null with confidence: 0.`,
            } satisfies Anthropic.TextBlockParam,
          ]

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentBlocks }],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('field extraction', errMsg)
    }

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()
    try {
      return JSON.parse(cleaned) as Record<string, unknown>
    } catch {
      this.logger.warn('Failed to parse field-level extraction JSON', cleaned.slice(0, 200))
      return { confidence: 0 }
    }
  }

  async generateReportSummary(
    reportType: string,
    dataSnapshot: Record<string, unknown>,
    tenantConfig: TenantConfig,
  ): Promise<string> {
    const systemPrompt = `You are a senior CA writing an executive summary for a CA firm principal.
Write a clear, professional 3-5 sentence summary of the report data.
Rules: Reference specific numbers in Indian format (₹1,23,456). Highlight the most important insight first. If compliance readiness data is present, mention the average readiness score and any overdue checklists by client name. End with one actionable recommendation.
Tone: professional, direct, no fluff.`

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Report type: ${reportType}\nBusiness context: ${tenantConfig.industryType} company.\n\nData:\n${JSON.stringify(dataSnapshot, null, 2)}`,
          },
        ],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('report summary', errMsg)
    }

    return response.content[0]?.type === 'text' ? response.content[0].text : ''
  }

  async generateDashboardInsights(
    summary: DashboardSummary,
    config: TenantConfig,
  ): Promise<Array<{ category: string; severity: string; summary: string }>> {
    const systemPrompt = `You are an operational analyst for an Indian SME. Analyze the provided business data and return ONLY a JSON array of insights. Each insight must:

* Reference specific numbers from the data
* Explain operational significance
* Be under 25 words
* Be actionable, not generic
Return format: [{ "category": string, "severity": "INFO"|"WARNING"|"CRITICAL", "summary": string }]
BAD: "Your collections seem to be declining." GOOD: "Overdue receivables up ₹1.2L this week — 3 customers account for 78% of the risk."
Never return motivational statements. Never hallucinate numbers not in the data.`

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Business context: ${config.industryType} company, persona: ${config.aiPersona}.\n\nCurrent data:\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
      })
    } catch (err) {
      if (err instanceof AppException) throw err
      const errMsg = err instanceof Error ? err.message : String(err)
      throw new AiServiceUnavailableException('dashboard insights', errMsg)
    }

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const parsed = JSON.parse(cleaned) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed as Array<{ category: string; severity: string; summary: string }>
    } catch {
      this.logger.warn('Failed to parse AI insight JSON', cleaned.slice(0, 200))
      return []
    }
  }
}
