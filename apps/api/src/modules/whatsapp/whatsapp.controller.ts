import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { WhatsAppService } from './whatsapp.service'
import { TemplateService } from './template.service'
import { SendMessageDto, SendMessageType } from './dto/send-message.dto'
import { ListMessagesDto } from './dto/list-messages.dto'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@opsc/types'

@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly templates: TemplateService,
  ) {}

  // ─── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsapp.getStats(user.companyId)
  }

  // ─── Messages ───────────────────────────────────────────────────────────────

  @Get('messages')
  listMessages(@CurrentUser() user: AuthenticatedUser, @Query() query: ListMessagesDto) {
    return this.whatsapp.listMessages(user.companyId, query)
  }

  // ─── Send (dispatcher) ──────────────────────────────────────────────────────

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    const { companyId } = user

    switch (dto.type) {
      case SendMessageType.FEE_REMINDER:
        if (!dto.invoiceId) return { error: 'invoiceId required for FEE_REMINDER' }
        return this.whatsapp.sendFeeReminder(dto.invoiceId, companyId)

      case SendMessageType.DOC_REQUEST:
        if (!dto.documentRequestId) return { error: 'documentRequestId required for DOC_REQUEST' }
        return this.whatsapp.sendDocumentRequest(dto.documentRequestId, companyId)

      case SendMessageType.DEADLINE_NUDGE:
        return this.whatsapp.sendDeadlineNudge(companyId)

      case SendMessageType.PAYMENT_ACK:
        if (!dto.invoiceId) return { error: 'invoiceId required for PAYMENT_ACK' }
        return this.whatsapp.sendPaymentAck(dto.invoiceId, companyId)
    }
  }

  // ─── Convenience shortcuts ───────────────────────────────────────────────────

  @Post('invoices/:invoiceId/remind')
  @HttpCode(HttpStatus.OK)
  sendReminder(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId') invoiceId: string) {
    return this.whatsapp.sendFeeReminder(invoiceId, user.companyId)
  }

  @Post('invoices/:invoiceId/payment-ack')
  @HttpCode(HttpStatus.OK)
  sendPaymentAck(@CurrentUser() user: AuthenticatedUser, @Param('invoiceId') invoiceId: string) {
    return this.whatsapp.sendPaymentAck(invoiceId, user.companyId)
  }

  @Post('deadline-nudge')
  @HttpCode(HttpStatus.OK)
  sendDeadlineNudge(@CurrentUser() user: AuthenticatedUser) {
    return this.whatsapp.sendDeadlineNudge(user.companyId)
  }

  // ─── Templates ──────────────────────────────────────────────────────────────

  @Get('templates')
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.templates.listTemplates(user.companyId)
  }

  @Put('templates/:key')
  updateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body('body') body: string,
  ) {
    return this.templates.updateTemplate(user.companyId, key, body)
  }

  // ─── Twilio Webhook (public — validated by Twilio signature) ───────────────
  //
  // Twilio sends two kinds of POSTs to this URL:
  //   A. Status callbacks:  data.MessageStatus is present
  //   B. Inbound messages:  data.From + data.Body (+ optional NumMedia/MediaUrl*)
  //
  // Both come to the same URL configured in the Twilio console.
  // Respond with 204 quickly — Twilio will retry if it gets a 5xx.

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
  async twilioWebhook(@Body() data: Record<string, string>) {
    if (data['MessageStatus']) {
      // Status callback (outbound message status update)
      await this.whatsapp.handleStatusCallback(data)
    } else if (data['From']) {
      // Inbound message — handle async (fire-and-forget so Twilio gets 204 fast)
      this.whatsapp.handleInbound(data).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        // Logger not available here — just console so we always have a trace
        console.error('[WhatsApp] handleInbound error:', msg)
      })
    }
  }
}
