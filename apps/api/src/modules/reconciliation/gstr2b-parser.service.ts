import { Injectable, Logger } from '@nestjs/common'
import ExcelJS from 'exceljs'
import Anthropic from '@anthropic-ai/sdk'

export interface ParsedLineItem {
  vendorGstin: string | null
  vendorName: string | null
  invoiceNumber: string | null
  invoiceDate: Date | null
  taxableAmount: number | null
  igst: number | null
  cgst: number | null
  sgst: number | null
  totalAmount: number | null
}

@Injectable()
export class Gstr2bParserService {
  private readonly logger = new Logger(Gstr2bParserService.name)
  private readonly anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] })
  // Use Haiku for parsing — cheap, fast, good at structured extraction
  private readonly haiku = 'claude-haiku-4-5-20251001'

  async parseExcel(buffer: Buffer): Promise<ParsedLineItem[]> {
    const workbook = new ExcelJS.Workbook()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any)

    // Try to find the B2B sheet by name variants
    const b2bSheet = workbook.worksheets.find((ws) =>
      /^b2b/i.test(ws.name.trim()) || /b2b/i.test(ws.name),
    ) ?? workbook.worksheets[0]

    if (!b2bSheet) return []

    // Detect header row — scan first 10 rows for a row containing GSTIN
    let headerRowNumber = 0
    let headers: string[] = []
    for (let r = 1; r <= 10; r++) {
      const row = b2bSheet.getRow(r)
      const cells = this.rowToStrings(row)
      if (cells.some((c) => /gstin/i.test(c))) {
        headerRowNumber = r
        headers = cells
        break
      }
    }
    if (!headerRowNumber) {
      this.logger.warn('Could not find header row in GSTR-2B Excel — sheet: ' + b2bSheet.name)
      return []
    }

    const colIdx = this.buildColMap(headers)
    const items: ParsedLineItem[] = []

    b2bSheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return
      const cells = this.rowToStrings(row)
      if (cells.every((c) => !c.trim())) return // skip blank rows

      items.push({
        vendorGstin: this.cellVal(cells, colIdx['gstin']),
        vendorName: this.cellVal(cells, colIdx['tradename']) ?? this.cellVal(cells, colIdx['name']),
        invoiceNumber: this.cellVal(cells, colIdx['invoiceno']) ?? this.cellVal(cells, colIdx['invoicenumber']),
        invoiceDate: this.parseDate(this.cellVal(cells, colIdx['invoicedate']) ?? this.cellVal(cells, colIdx['date'])),
        taxableAmount: this.parseNum(this.cellVal(cells, colIdx['taxablevalue']) ?? this.cellVal(cells, colIdx['taxable'])),
        igst: this.parseNum(this.cellVal(cells, colIdx['igst'])),
        cgst: this.parseNum(this.cellVal(cells, colIdx['cgst'])),
        sgst: this.parseNum(this.cellVal(cells, colIdx['sgst'])),
        totalAmount: this.parseNum(this.cellVal(cells, colIdx['invoicevalue']) ?? this.cellVal(cells, colIdx['total'])),
      })
    })

    return items.filter((i) => i.vendorGstin || i.invoiceNumber)
  }

  async parsePdf(base64Content: string): Promise<ParsedLineItem[]> {
    const systemPrompt = `You are a GSTR-2B document parser for Indian CA firms.
Extract all B2B vendor invoice line items from the GSTR-2B statement.
Return ONLY a JSON array. Each element:
{ "vendorGstin": string|null, "vendorName": string|null, "invoiceNumber": string|null, "invoiceDate": "YYYY-MM-DD"|null, "taxableAmount": number|null, "igst": number|null, "cgst": number|null, "sgst": number|null, "totalAmount": number|null }
Extract every invoice line. Return [] if no B2B section found. No markdown, no explanation.`

    let response: Awaited<ReturnType<typeof this.anthropic.messages.create>>
    try {
      response = await this.anthropic.messages.create({
        model: this.haiku,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64Content },
              },
              { type: 'text', text: 'Extract all B2B invoice lines from this GSTR-2B.' },
            ],
          },
        ],
      })
    } catch (err) {
      this.logger.error('Haiku PDF parse failed', err)
      throw err
    }

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : '[]'
    const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      const parsed = JSON.parse(cleaned) as unknown[]
      if (!Array.isArray(parsed)) return []
      return parsed.map((item) => {
        const i = item as Record<string, unknown>
        return {
          vendorGstin: (i['vendorGstin'] as string | null) ?? null,
          vendorName: (i['vendorName'] as string | null) ?? null,
          invoiceNumber: (i['invoiceNumber'] as string | null) ?? null,
          invoiceDate: i['invoiceDate'] ? new Date(i['invoiceDate'] as string) : null,
          taxableAmount: typeof i['taxableAmount'] === 'number' ? i['taxableAmount'] : null,
          igst: typeof i['igst'] === 'number' ? i['igst'] : null,
          cgst: typeof i['cgst'] === 'number' ? i['cgst'] : null,
          sgst: typeof i['sgst'] === 'number' ? i['sgst'] : null,
          totalAmount: typeof i['totalAmount'] === 'number' ? i['totalAmount'] : null,
        }
      })
    } catch {
      this.logger.warn('Failed to parse Haiku GSTR-2B response', cleaned.slice(0, 200))
      return []
    }
  }

  private rowToStrings(row: ExcelJS.Row): string[] {
    const cells: string[] = []
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value
      if (v === null || v === undefined) { cells.push(''); return }
      if (typeof v === 'object' && 'text' in v) { cells.push(String((v as { text: unknown }).text)); return }
      if (v instanceof Date) { cells.push(v.toISOString().split('T')[0]!); return }
      cells.push(String(v))
    })
    return cells
  }

  private buildColMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {}
    headers.forEach((h, i) => {
      const key = h.toLowerCase().replace(/[\s/()_-]/g, '')
      map[key] = i
    })
    return map
  }

  private cellVal(cells: string[], idx: number | undefined): string | null {
    if (idx === undefined || idx < 0) return null
    const v = cells[idx]?.trim()
    return v || null
  }

  private parseNum(v: string | null): number | null {
    if (!v) return null
    const n = parseFloat(v.replace(/[₹,\s]/g, '').replace(/[^\d.]/g, ''))
    return isNaN(n) ? null : n
  }

  private parseDate(v: string | null): Date | null {
    if (!v) return null
    // Handle DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
    const parts = v.split(/[\/\-]/)
    if (parts.length === 3) {
      const [a, b, c] = parts
      // If first part looks like a year
      if (a && a.length === 4) return new Date(`${a}-${b?.padStart(2, '0')}-${c?.padStart(2, '0')}`)
      // DD/MM/YYYY
      if (c && c.length === 4) return new Date(`${c}-${b?.padStart(2, '0')}-${a?.padStart(2, '0')}`)
    }
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
}
