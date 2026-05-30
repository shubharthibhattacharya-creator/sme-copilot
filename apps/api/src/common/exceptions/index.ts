import { HttpStatus } from '@nestjs/common'
import { AppException } from './app.exception'

export { AppException } from './app.exception'

// ─── DOCUMENT EXCEPTIONS ─────────────────────────────────────────────────────

export class DocumentOcrFailedException extends AppException {
  constructor(detail?: string) {
    super(
      'DOCUMENT_OCR_FAILED',
      'We could not read this document automatically.',
      'Upload a clearer scan or a PDF instead of a photo. Ensure text is not blurry.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
    )
  }
}

export class DocumentTooLargeException extends AppException {
  constructor(sizeMb: number) {
    super(
      'DOCUMENT_TOO_LARGE',
      `This file is ${sizeMb}MB — too large to upload.`,
      'Maximum file size is 10MB. Compress the PDF or split into smaller files.',
      HttpStatus.BAD_REQUEST,
    )
  }
}

export class DocumentTypeNotSupportedException extends AppException {
  constructor(mimeType: string) {
    super(
      'DOCUMENT_TYPE_NOT_SUPPORTED',
      'This file type cannot be uploaded.',
      'Please upload a PDF, JPG, or PNG file only.',
      HttpStatus.BAD_REQUEST,
      mimeType,
    )
  }
}

export class DocumentAlreadyVerifiedException extends AppException {
  constructor() {
    super(
      'DOCUMENT_ALREADY_VERIFIED',
      'This document has already been verified and cannot be changed.',
      'To correct it, reject the document first and re-upload the correct version.',
      HttpStatus.CONFLICT,
    )
  }
}

export class DocumentNotReadyException extends AppException {
  constructor() {
    super(
      'DOCUMENT_NOT_READY',
      'This document is still being processed.',
      'Wait a few seconds and refresh the page. OCR usually completes within 30 seconds.',
      HttpStatus.CONFLICT,
    )
  }
}

// ─── WHATSAPP EXCEPTIONS ──────────────────────────────────────────────────────

export class WhatsAppSendFailedException extends AppException {
  constructor(clientName: string, detail?: string) {
    super(
      'WHATSAPP_SEND_FAILED',
      `Could not send WhatsApp message to ${clientName}.`,
      'Check that the phone number is correct and includes the country code (+91).',
      HttpStatus.BAD_GATEWAY,
      detail,
    )
  }
}

export class WhatsAppRateLimitException extends AppException {
  constructor() {
    super(
      'WHATSAPP_RATE_LIMIT',
      'Too many messages sent too quickly.',
      'Wait 2 minutes before sending more messages. Twilio limits bulk sends.',
      HttpStatus.TOO_MANY_REQUESTS,
    )
  }
}

export class WhatsAppTemplateNotFoundException extends AppException {
  constructor(templateName: string) {
    super(
      'WHATSAPP_TEMPLATE_NOT_FOUND',
      `The WhatsApp template '${templateName}' could not be found.`,
      'Go to Settings → WhatsApp Templates and check the template exists.',
      HttpStatus.NOT_FOUND,
    )
  }
}

// ─── COLLECTIONS / INVOICE EXCEPTIONS ────────────────────────────────────────

export class InvoiceAlreadyPaidException extends AppException {
  constructor(invoiceRef: string) {
    super(
      'INVOICE_ALREADY_PAID',
      `Invoice ${invoiceRef} is already marked as paid.`,
      'If this is a mistake, ask your administrator to reverse it.',
      HttpStatus.CONFLICT,
    )
  }
}

export class InvoiceNotFoundException extends AppException {
  constructor() {
    super(
      'INVOICE_NOT_FOUND',
      'This invoice could not be found.',
      'It may have been deleted, or you may not have permission to view it.',
      HttpStatus.NOT_FOUND,
    )
  }
}

// ─── CLIENT EXCEPTIONS ────────────────────────────────────────────────────────

export class InvalidGstinException extends AppException {
  constructor(gstin: string) {
    super(
      'INVALID_GSTIN',
      `'${gstin}' is not a valid GSTIN.`,
      'GSTIN must be 15 characters: 2-digit state code + 10-char PAN + 1 + Z + check digit. Example: 27AAACR5055K1Z5',
      HttpStatus.BAD_REQUEST,
    )
  }
}

export class InvalidPanException extends AppException {
  constructor(pan: string) {
    super(
      'INVALID_PAN',
      `'${pan}' is not a valid PAN number.`,
      'PAN must be 10 characters in the format AAAAA9999A.',
      HttpStatus.BAD_REQUEST,
    )
  }
}

export class ClientAlreadyExistsException extends AppException {
  constructor(gstin: string) {
    super(
      'CLIENT_ALREADY_EXISTS',
      `A client with GSTIN ${gstin} already exists in your firm.`,
      'Search for the existing client rather than adding a duplicate.',
      HttpStatus.CONFLICT,
    )
  }
}

// ─── PLAN LIMIT EXCEPTIONS ────────────────────────────────────────────────────

export class PlanLimitExceededException extends AppException {
  constructor(resource: string, used: number, limit: number, plan: string) {
    const labels: Record<string, string> = {
      clients: 'clients',
      users: 'team members',
      documentsPerMonth: 'documents this month',
      aiCallsPerMonth: 'AI actions this month',
      whatsappPerMonth: 'WhatsApp messages this month',
      reportsPerMonth: 'reports this month',
      taxIntegrations: 'tax integrations',
    }
    super(
      'PLAN_LIMIT_EXCEEDED',
      `You have reached your limit of ${limit} ${labels[resource] ?? resource} on the ${plan} plan.`,
      'Upgrade your plan to continue, or contact support for a temporary increase.',
      HttpStatus.PAYMENT_REQUIRED,
    )
  }
}

// ─── TAX INTEGRATION EXCEPTIONS ──────────────────────────────────────────────

export class TaxIntegrationConnectionFailedException extends AppException {
  constructor(provider: string, detail?: string) {
    super(
      'TAX_INTEGRATION_CONNECTION_FAILED',
      `Could not connect to ${provider}.`,
      `Check your ${provider} credentials in Settings → Integrations and click Test Connection.`,
      HttpStatus.BAD_GATEWAY,
      detail,
    )
  }
}

export class TaxSyncFailedException extends AppException {
  constructor(provider: string, docName: string, detail?: string) {
    super(
      'TAX_SYNC_FAILED',
      `Could not sync '${docName}' to ${provider}.`,
      'The document is saved in OpsCopilot. Retry from the document drawer, or download as CSV to import manually.',
      HttpStatus.BAD_GATEWAY,
      detail,
    )
  }
}

// ─── REPORT EXCEPTIONS ────────────────────────────────────────────────────────

export class ReportGenerationFailedException extends AppException {
  constructor(reportType: string, detail?: string) {
    super(
      'REPORT_GENERATION_FAILED',
      `The ${reportType} report could not be generated.`,
      'Try again in a few minutes. If the problem persists, contact support.',
      HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
    )
  }
}

export class ReportStillGeneratingException extends AppException {
  constructor() {
    super(
      'REPORT_STILL_GENERATING',
      'This report is still being generated.',
      'Large reports can take up to 60 seconds. Refresh the page in a moment.',
      HttpStatus.ACCEPTED,
    )
  }
}

// ─── AUTH / ACCESS EXCEPTIONS ─────────────────────────────────────────────────

export class FirmSuspendedException extends AppException {
  constructor() {
    super(
      'FIRM_SUSPENDED',
      'Your firm account has been suspended.',
      'Contact OpsCopilot support to resolve this.',
      HttpStatus.FORBIDDEN,
    )
  }
}

export class InsufficientRoleException extends AppException {
  constructor(requiredRole: string) {
    super(
      'INSUFFICIENT_ROLE',
      'You do not have permission to perform this action.',
      `This action requires the ${requiredRole} role. Ask your firm administrator.`,
      HttpStatus.FORBIDDEN,
    )
  }
}

// ─── FILE UPLOAD EXCEPTIONS ───────────────────────────────────────────────────

export class S3UploadFailedException extends AppException {
  constructor(detail?: string) {
    super(
      'S3_UPLOAD_FAILED',
      'The file could not be saved.',
      'Try uploading again. If the problem persists, contact support.',
      HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
    )
  }
}

// ─── CSV IMPORT EXCEPTIONS ────────────────────────────────────────────────────

export class CsvImportPartialException extends AppException {
  constructor(imported: number, failed: number, errors: string[]) {
    super(
      'CSV_IMPORT_PARTIAL',
      `Imported ${imported} records. ${failed} rows had errors and were skipped.`,
      errors.slice(0, 3).join(' | '),
      HttpStatus.PARTIAL_CONTENT,
    )
  }
}

export class CsvFormatException extends AppException {
  constructor(detail: string) {
    super(
      'CSV_FORMAT_INVALID',
      'The CSV file format is not recognised.',
      `Download the template from the import screen and ensure column headers match exactly. Detail: ${detail}`,
      HttpStatus.BAD_REQUEST,
    )
  }
}

// ─── AI / CLAUDE EXCEPTIONS ───────────────────────────────────────────────────

export class AiServiceUnavailableException extends AppException {
  constructor(feature: string, detail?: string) {
    super(
      'AI_SERVICE_UNAVAILABLE',
      `The AI service for ${feature} is temporarily unavailable.`,
      'This is usually a brief outage. Try again in a few minutes.',
      HttpStatus.SERVICE_UNAVAILABLE,
      detail,
    )
  }
}

export class AiResponseInvalidException extends AppException {
  constructor(feature: string, detail?: string) {
    super(
      'AI_RESPONSE_INVALID',
      `The AI could not process this ${feature} correctly.`,
      'Try again. If the problem continues with the same file, contact support.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      detail,
    )
  }
}

// ─── KNOWLEDGE BASE EXCEPTIONS ───────────────────────────────────────────────

export class KnowledgeDocumentTooLargeException extends AppException {
  constructor(sizeMb: number) {
    super(
      'KNOWLEDGE_DOC_TOO_LARGE',
      `This SOP document is ${sizeMb}MB — too large to index.`,
      'Maximum SOP document size is 5MB. Split it into sections and upload separately.',
      HttpStatus.BAD_REQUEST,
    )
  }
}
