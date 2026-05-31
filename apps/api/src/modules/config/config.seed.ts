import type { PrismaClient } from '@opsc/database'

interface SystemConfigRow {
  key: string
  value: string
  dataType: 'NUMBER' | 'BOOLEAN' | 'STRING' | 'JSON'
  category: 'COLLECTIONS' | 'AI_INSIGHTS' | 'GST_COMPLIANCE' | 'DOCUMENTS' | 'REPORTS' | 'WHATSAPP'
  label: string
  description: string
  unit?: string
  minValue?: string
  maxValue?: string
  defaultValue?: string
  isPublic?: boolean
}

export const SYSTEM_CONFIG_ROWS: SystemConfigRow[] = [
  // ── Collections ──────────────────────────────────────────────────────────────
  { key: 'aging_bucket_1_max', value: '30', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 1 max (days)', description: 'Upper bound (days overdue) for the first aging bucket.', unit: 'days', minValue: '1', maxValue: '90', defaultValue: '30' },
  { key: 'aging_bucket_2_max', value: '60', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 2 max (days)', description: 'Upper bound for the second aging bucket. Must be greater than bucket 1.', unit: 'days', minValue: '1', maxValue: '180', defaultValue: '60' },
  { key: 'aging_bucket_3_max', value: '90', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 3 max (days)', description: 'Upper bound for the third aging bucket — above this is bucket 4 (90+).', unit: 'days', minValue: '1', maxValue: '365', defaultValue: '90' },
  { key: 'risk_weight_aging', value: '0.5', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — aging', description: 'Contribution of invoice aging to risk score. Must sum to 1 with amount and history weights.', unit: 'score (0–1)', minValue: '0', maxValue: '1', defaultValue: '0.5' },
  { key: 'risk_weight_amount', value: '0.3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — amount', description: 'Contribution of invoice amount (relative to company avg) to risk score. Must sum to 1 with aging and history weights.', unit: 'score (0–1)', minValue: '0', maxValue: '1', defaultValue: '0.3' },
  { key: 'risk_weight_history', value: '0.2', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — payment history', description: 'Contribution of customer historical late-payment rate to risk score. Must sum to 1 with aging and amount weights.', unit: 'score (0–1)', minValue: '0', maxValue: '1', defaultValue: '0.2' },
  { key: 'risk_threshold_high', value: '0.7', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'High risk threshold', description: 'Invoices scoring at or above this are marked HIGH risk.', unit: 'score (0–1)', minValue: '0.1', maxValue: '0.99', defaultValue: '0.7' },
  { key: 'risk_threshold_medium', value: '0.3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Medium risk threshold', description: 'Invoices scoring at or above this (but below high) are marked MEDIUM risk.', unit: 'score (0–1)', minValue: '0.05', maxValue: '0.9', defaultValue: '0.3' },
  { key: 'reminder_interval_days', value: '7', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Reminder interval (days)', description: 'Minimum days between automated payment reminders to the same client.', unit: 'days', minValue: '1', maxValue: '90', defaultValue: '7' },
  { key: 'max_reminders_per_invoice', value: '3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Max reminders per invoice', description: 'Maximum number of automated reminders sent per overdue invoice before escalation.', unit: 'count', minValue: '1', maxValue: '10', defaultValue: '3' },
  { key: 'critical_customer_count', value: '3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Critical customers shown', description: 'Number of highest-risk customers shown in the dashboard critical customers panel.', unit: 'count', minValue: '1', maxValue: '20', defaultValue: '3' },
  { key: 'delay_multiplier', value: '1.0', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Delay multiplier', description: 'Multiplier applied to aging days when predicting payment delay. 1.0 = no adjustment.', unit: 'multiplier', minValue: '0.5', maxValue: '5', defaultValue: '1.0' },
  { key: 'collections_default_payment_terms_days', value: '30', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Default payment terms (days)', description: 'Number of days after invoice date before payment is due, used when creating invoices from uploaded PDFs.', unit: 'days', minValue: '1', maxValue: '365', defaultValue: '30' },

  // ── AI Insights ───────────────────────────────────────────────────────────────
  { key: 'insight_critical_overdue_amount', value: '100000', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Critical overdue amount (₹)', description: 'Total overdue balance above this amount triggers a CRITICAL severity insight.', unit: 'INR', minValue: '10000', maxValue: '10000000', defaultValue: '100000' },
  { key: 'insight_warning_overdue_count', value: '5', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Warning overdue count', description: 'Number of overdue invoices above which a WARNING severity insight is generated.', unit: 'count', minValue: '1', maxValue: '100', defaultValue: '5' },
  { key: 'insight_warning_trend_percent', value: '-10', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Warning trend threshold (%)', description: 'Week-over-week collections decline below this % triggers a WARNING insight.', unit: '%', minValue: '-100', maxValue: '0', defaultValue: '-10' },
  { key: 'insight_trend_window_days', value: '7', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Trend comparison window (days)', description: 'Number of days used for week-over-week collections trend calculation.', unit: 'days', minValue: '1', maxValue: '30', defaultValue: '7' },
  { key: 'max_insights_per_refresh', value: '5', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Max insights per refresh', description: 'Maximum number of AI insights generated and stored per dashboard refresh.', unit: 'count', minValue: '1', maxValue: '20', defaultValue: '5' },
  { key: 'insight_min_severity', value: '"INFO"', dataType: 'STRING', category: 'AI_INSIGHTS', label: 'Minimum insight severity', description: 'Only show insights at or above this severity in the dashboard feed. Set to WARNING to reduce noise.', defaultValue: '"INFO"' },

  // ── GST Compliance ────────────────────────────────────────────────────────────
  { key: 'gst_deadline_day', value: '20', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'GST filing deadline day', description: 'Day of the following month by which clients must file GSTR-3B. Set lower (17–18) for early buffer.', unit: 'day of month', minValue: '1', maxValue: '28', defaultValue: '20' },
  { key: 'gst_deadline_urgency_days', value: '5', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Deadline urgency window (days)', description: 'Show red deadline badge and trigger WhatsApp nudge when days remaining is below this value.', unit: 'days', minValue: '1', maxValue: '15', defaultValue: '5' },
  { key: 'quarterly_deadline_months', value: '[4,7,10,1]', dataType: 'JSON', category: 'GST_COMPLIANCE', label: 'Quarterly deadline months', description: 'Months (1–12) in which quarterly GST deadlines fall (April=4, July=7, Oct=10, Jan=1).', unit: 'month numbers', defaultValue: '[4,7,10,1]' },
  { key: 'late_fee_rate_per_day', value: '50', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Late fee per day (₹)', description: 'GST late filing fee per day shown as estimated penalty in reports. ₹50/day standard; ₹20/day for NIL returns.', unit: '₹/day', minValue: '0', maxValue: '500', defaultValue: '50' },
  { key: 'gst_filing_reminder_days_before', value: '7', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Filing reminder lead (days)', description: 'Send compliance reminder notifications this many days before the GST deadline.', unit: 'days', minValue: '1', maxValue: '20', defaultValue: '7' },
  { key: 'gst_grace_period_days', value: '0', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Grace period (days)', description: 'Checklist status is set to OVERDUE only after deadline + this many grace days. Set 0 for strict enforcement.', unit: 'days', minValue: '0', maxValue: '10', defaultValue: '0' },
  { key: 'tds_deadline_day', value: '7', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'TDS deadline day', description: 'Day of the month following quarter end by which TDS must be deposited.', unit: 'day of month', minValue: '1', maxValue: '28', defaultValue: '7' },

  // ── Documents ─────────────────────────────────────────────────────────────────
  { key: 'max_file_size_mb', value: '10', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Max file size (MB)', description: 'Maximum file size allowed for document uploads. Files above this are rejected.', unit: 'MB', minValue: '1', maxValue: '50', defaultValue: '10' },
  { key: 'confidence_threshold_green', value: '0.8', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'High confidence threshold', description: 'OCR confidence at or above this shows a green indicator — extraction is reliable.', unit: 'score (0–1)', minValue: '0.5', maxValue: '1', defaultValue: '0.8' },
  { key: 'confidence_threshold_amber', value: '0.6', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Minimum confidence threshold', description: 'Documents with OCR confidence below this are marked NEEDS_REVIEW. Must be above auto-reject threshold.', unit: 'score (0–1)', minValue: '0.1', maxValue: '0.9', defaultValue: '0.6' },
  { key: 'auto_reject_below_confidence', value: 'null', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Auto-reject below confidence', description: 'Automatically mark documents as FAILED if OCR confidence is below this value. Must be less than minimum confidence threshold. Set to null to disable.', unit: 'score (0–1)', defaultValue: 'null' },
  { key: 'ocr_poll_interval_seconds', value: '3', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'OCR poll interval (seconds)', description: 'How frequently the frontend polls for OCR processing status updates.', unit: 'seconds', minValue: '1', maxValue: '30', defaultValue: '3', isPublic: false },
  { key: 'document_classification_mode', value: '"smart"', dataType: 'STRING', category: 'DOCUMENTS', label: 'Document classification mode', description: 'How the system determines whether an uploaded document is your firm\'s fee invoice or a client\'s tax document. smart = context + OCR; explicit = you choose every time.', defaultValue: '"smart"' },
  { key: 'document_request_expiry_days', value: '14', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Document request expiry (days)', description: 'Pending document requests older than this are automatically expired and a follow-up notification is created.', unit: 'days', minValue: '3', maxValue: '60', defaultValue: '14' },
  { key: 'document_ocr_max_retries', value: '3', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'OCR max retries', description: 'Number of times the OCR pipeline retries extraction before marking a document as FAILED.', unit: 'count', minValue: '1', maxValue: '5', defaultValue: '3' },

  // ── Reports ───────────────────────────────────────────────────────────────────
  { key: 'default_report_period', value: '"current_month"', dataType: 'STRING', category: 'REPORTS', label: 'Default report period', description: 'Default date range pre-selected when generating a new report.', defaultValue: '"current_month"' },
  { key: 'report_poll_interval_seconds', value: '5', dataType: 'NUMBER', category: 'REPORTS', label: 'Report poll interval (seconds)', description: 'How frequently the frontend polls for report generation status.', unit: 'seconds', minValue: '1', maxValue: '30', defaultValue: '5', isPublic: false },
  { key: 'report_timeout_seconds', value: '120', dataType: 'NUMBER', category: 'REPORTS', label: 'Report generation timeout (seconds)', description: 'Maximum time allowed before a report generation attempt is marked as failed.', unit: 'seconds', minValue: '30', maxValue: '600', defaultValue: '120' },
  { key: 'auto_report_enabled', value: 'false', dataType: 'BOOLEAN', category: 'REPORTS', label: 'Auto-generate monthly reports', description: 'Automatically generate a collections aging report at the start of each month.', defaultValue: 'false' },
  { key: 'auto_report_day_of_month', value: '1', dataType: 'NUMBER', category: 'REPORTS', label: 'Auto-report day of month', description: 'Day of month on which auto-reports are generated (only applies when auto-generate is enabled).', unit: 'day', minValue: '1', maxValue: '28', defaultValue: '1' },
  { key: 'auto_report_recipients', value: '[]', dataType: 'JSON', category: 'REPORTS', label: 'Auto-report recipients', description: 'Email addresses that receive auto-generated reports. Leave empty to disable email delivery.', defaultValue: '[]' },
  { key: 'report_retention_days', value: '90', dataType: 'NUMBER', category: 'REPORTS', label: 'Report retention (days)', description: 'Reports older than this are automatically deleted. Keeps storage clean.', unit: 'days', minValue: '7', maxValue: '365', defaultValue: '90' },

  // ── WhatsApp ──────────────────────────────────────────────────────────────────
  { key: 'whatsapp_max_per_minute', value: '10', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Max messages per minute', description: 'Rate limit: maximum WhatsApp messages sent per minute per company to avoid Twilio throttling.', unit: 'msgs/min', minValue: '1', maxValue: '60', defaultValue: '10' },
  { key: 'whatsapp_nudge_window_days', value: '7', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Deadline nudge window (days)', description: 'Send nudge messages to clients with outstanding documents due within this many days.', unit: 'days', minValue: '1', maxValue: '30', defaultValue: '7' },
  { key: 'whatsapp_quiet_hours_start', value: '22', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Quiet hours start', description: 'Hour of day (24h) after which WhatsApp messages are queued, not sent immediately.', unit: 'hour (0–23)', minValue: '0', maxValue: '23', defaultValue: '22' },
  { key: 'whatsapp_quiet_hours_end', value: '8', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Quiet hours end', description: 'Hour of day (24h) after which queued messages resume sending. Must differ from start.', unit: 'hour (0–23)', minValue: '0', maxValue: '23', defaultValue: '8' },
  { key: 'whatsapp_max_per_invoice', value: '3', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Max reminders per invoice', description: 'Maximum number of WhatsApp reminders sent per overdue invoice before stopping automated reminders.', unit: 'count', minValue: '1', maxValue: '10', defaultValue: '3' },
  { key: 'whatsapp_daily_message_limit', value: '100', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Daily message limit', description: 'Total outbound WhatsApp messages per company per day. Prevents accidental bulk spam.', unit: 'msgs/day', minValue: '10', maxValue: '1000', defaultValue: '100' },
  { key: 'whatsapp_rate_limit_per_hour', value: '20', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Rate limit per hour', description: 'Max messages per hour per company. Stays safely below Twilio rate limits.', unit: 'msgs/hour', minValue: '1', maxValue: '100', defaultValue: '20' },
  { key: 'whatsapp_auto_reply_enabled', value: 'true', dataType: 'BOOLEAN', category: 'WHATSAPP', label: 'Auto-reply to inbound messages', description: 'When enabled, clients who send messages receive an automatic acknowledgement. When disabled, messages are logged but no reply is sent.', defaultValue: 'true' },
]

export async function seedSystemConfig(prisma: PrismaClient): Promise<void> {
  for (const row of SYSTEM_CONFIG_ROWS) {
    await prisma.systemConfig.upsert({
      where: { key: row.key },
      update: {
        label: row.label,
        description: row.description,
        unit: row.unit,
        minValue: row.minValue,
        maxValue: row.maxValue,
        defaultValue: row.defaultValue ?? row.value,
        isPublic: row.isPublic ?? true,
        dataType: row.dataType,
        category: row.category,
      },
      create: {
        ...row,
        defaultValue: row.defaultValue ?? row.value,
        isPublic: row.isPublic ?? true,
      },
    })
  }
}
