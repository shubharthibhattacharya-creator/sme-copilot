import { Injectable, Logger } from '@nestjs/common'
import twilio from 'twilio'

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name)
  private readonly client: twilio.Twilio | null

  constructor() {
    const sid = process.env['TWILIO_ACCOUNT_SID']
    const token = process.env['TWILIO_AUTH_TOKEN']
    if (sid && token && !sid.startsWith('AC0') && sid !== 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      this.client = twilio(sid, token)
    } else {
      this.logger.warn('Twilio credentials not configured — WhatsApp sending disabled')
      this.client = null
    }
  }

  get isConfigured(): boolean {
    return this.client !== null
  }

  async sendWhatsApp(to: string, body: string): Promise<{ sid: string }> {
    if (!this.client) {
      this.logger.warn(`Twilio not configured — would have sent to ${to}`)
      return { sid: `mock_${Date.now()}` }
    }
    const from = process.env['TWILIO_WHATSAPP_FROM'] ?? 'whatsapp:+14155238886'
    const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`
    const message = await this.client.messages.create({ from, to: toFormatted, body })
    return { sid: message.sid }
  }

  async getMessageStatus(sid: string): Promise<string> {
    if (!this.client || sid.startsWith('mock_')) return 'delivered'
    const message = await this.client.messages(sid).fetch()
    return message.status
  }

  validateRequest(signature: string, url: string, params: Record<string, string>): boolean {
    if (!this.client) return true // dev mode
    const authToken = process.env['TWILIO_AUTH_TOKEN'] ?? ''
    return twilio.validateRequest(authToken, signature, url, params)
  }

  /**
   * Download a Twilio media attachment (requires Basic auth with account credentials).
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    const sid = process.env['TWILIO_ACCOUNT_SID'] ?? ''
    const token = process.env['TWILIO_AUTH_TOKEN'] ?? ''

    if (!this.client) {
      // Dev mode — return a tiny 1×1 white PNG so OCR can still run
      this.logger.warn(`Twilio not configured — returning placeholder buffer for ${mediaUrl}`)
      return Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      )
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64')
    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${auth}` },
    })

    if (!response.ok) {
      throw new Error(`Failed to download Twilio media (${response.status}): ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }
}
