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
}

export const SYSTEM_CONFIG_ROWS: SystemConfigRow[] = [
  // ── Collections ──────────────────────────────────────────────────────────────
  { key: 'aging_bucket_1_max', value: '30', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 1 max (days)', description: 'Upper bound (days overdue) for the first aging bucket', unit: 'days', minValue: '1', maxValue: '90' },
  { key: 'aging_bucket_2_max', value: '60', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 2 max (days)', description: 'Upper bound for the second aging bucket', unit: 'days', minValue: '1', maxValue: '180' },
  { key: 'aging_bucket_3_max', value: '90', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Aging bucket 3 max (days)', description: 'Upper bound for the third aging bucket — above this is bucket 4 (90+)', unit: 'days', minValue: '1', maxValue: '365' },
  { key: 'risk_weight_aging', value: '0.5', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — aging', description: 'Contribution of invoice aging to risk score. Must sum to 1 with amount and history weights.', unit: 'score (0–1)', minValue: '0', maxValue: '1' },
  { key: 'risk_weight_amount', value: '0.3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — amount', description: 'Contribution of invoice amount (relative to company avg) to risk score.', unit: 'score (0–1)', minValue: '0', maxValue: '1' },
  { key: 'risk_weight_history', value: '0.2', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Risk weight — payment history', description: 'Contribution of customer historical late-payment rate to risk score.', unit: 'score (0–1)', minValue: '0', maxValue: '1' },
  { key: 'risk_threshold_high', value: '0.7', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'High risk threshold', description: 'Invoices scoring at or above this are marked HIGH risk.', unit: 'score (0–1)', minValue: '0.1', maxValue: '0.99' },
  { key: 'risk_threshold_medium', value: '0.3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Medium risk threshold', description: 'Invoices scoring at or above this (but below high) are marked MEDIUM risk.', unit: 'score (0–1)', minValue: '0.05', maxValue: '0.9' },
  { key: 'reminder_interval_days', value: '7', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Reminder interval (days)', description: 'Minimum days between automated payment reminders to the same client.', unit: 'days', minValue: '1', maxValue: '90' },
  { key: 'max_reminders_per_invoice', value: '3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Max reminders per invoice', description: 'Maximum number of automated reminders sent per overdue invoice before escalation.', unit: 'count', minValue: '1', maxValue: '10' },
  { key: 'critical_customer_count', value: '3', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Critical customers shown', description: 'Number of highest-risk customers shown in the dashboard critical customers panel.', unit: 'count', minValue: '1', maxValue: '20' },
  { key: 'delay_multiplier', value: '1.0', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Delay multiplier', description: 'Multiplier applied to aging days when predicting payment delay. 1.0 = no adjustment.', unit: 'multiplier', minValue: '0.5', maxValue: '5' },
  // ── AI Insights ───────────────────────────────────────────────────────────────
  { key: 'insight_critical_overdue_amount', value: '100000', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Critical overdue amount', description: 'Total overdue balance above this amount triggers a CRITICAL severity insight floor.', unit: 'INR', minValue: '10000', maxValue: '10000000' },
  { key: 'insight_warning_overdue_count', value: '5', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Warning overdue count', description: 'Number of overdue invoices above which a WARNING severity floor is applied.', unit: 'count', minValue: '1', maxValue: '100' },
  { key: 'insight_warning_trend_percent', value: '-10', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Warning trend threshold (%)', description: 'Week-over-week collections decline below this % triggers a WARNING severity floor.', unit: '%', minValue: '-100', maxValue: '0' },
  { key: 'insight_trend_window_days', value: '7', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Trend comparison window (days)', description: 'Number of days used for week-over-week collections trend calculation.', unit: 'days', minValue: '1', maxValue: '30' },
  { key: 'max_insights_per_refresh', value: '5', dataType: 'NUMBER', category: 'AI_INSIGHTS', label: 'Max insights per refresh', description: 'Maximum number of AI insights generated and stored per dashboard refresh.', unit: 'count', minValue: '1', maxValue: '10' },
  // ── GST Compliance ────────────────────────────────────────────────────────────
  { key: 'gst_deadline_day', value: '20', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'GST filing deadline day', description: 'Day of the following month by which clients must file GSTR-3B.', unit: 'day of month', minValue: '1', maxValue: '28' },
  { key: 'gst_deadline_urgency_days', value: '10', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Deadline urgency window (days)', description: 'Number of days before the filing deadline when urgency alerts are triggered.', unit: 'days', minValue: '1', maxValue: '28' },
  { key: 'quarterly_deadline_months', value: '[4,7,10,1]', dataType: 'JSON', category: 'GST_COMPLIANCE', label: 'Quarterly deadline months', description: 'Months (1–12) in which quarterly GST deadlines fall (e.g., April=4, July=7, Oct=10, Jan=1).', unit: 'month numbers' },
  { key: 'late_fee_rate_per_day', value: '50', dataType: 'NUMBER', category: 'GST_COMPLIANCE', label: 'Late fee per day (INR)', description: 'GST late filing fee per day. ₹50/day standard; ₹20/day for NIL returns.', unit: 'INR/day', minValue: '0', maxValue: '500' },
  // ── Documents ─────────────────────────────────────────────────────────────────
  { key: 'max_file_size_mb', value: '10', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Max file size (MB)', description: 'Maximum file size allowed for document uploads.', unit: 'MB', minValue: '1', maxValue: '50' },
  { key: 'confidence_threshold_green', value: '0.8', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'High confidence threshold', description: 'OCR confidence at or above this shows a green indicator — extraction is reliable.', unit: 'score (0–1)', minValue: '0.5', maxValue: '1' },
  { key: 'confidence_threshold_amber', value: '0.6', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Low confidence threshold', description: 'OCR confidence below this shows a red indicator — manual review strongly recommended.', unit: 'score (0–1)', minValue: '0.1', maxValue: '0.9' },
  { key: 'auto_reject_below_confidence', value: 'null', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'Auto-reject below confidence', description: 'Automatically mark documents as FAILED if OCR confidence is below this value. Set to null to disable.', unit: 'score (0–1)' },
  { key: 'ocr_poll_interval_seconds', value: '3', dataType: 'NUMBER', category: 'DOCUMENTS', label: 'OCR poll interval (seconds)', description: 'How frequently the frontend polls for OCR processing status updates.', unit: 'seconds', minValue: '1', maxValue: '30' },
  // ── Reports ───────────────────────────────────────────────────────────────────
  { key: 'default_report_period', value: '"current_month"', dataType: 'STRING', category: 'REPORTS', label: 'Default report period', description: 'Default date range pre-selected when generating a new report.' },
  { key: 'report_poll_interval_seconds', value: '5', dataType: 'NUMBER', category: 'REPORTS', label: 'Report poll interval (seconds)', description: 'How frequently the frontend polls for report generation status.', unit: 'seconds', minValue: '1', maxValue: '30' },
  { key: 'report_timeout_seconds', value: '30', dataType: 'NUMBER', category: 'REPORTS', label: 'Report timeout (seconds)', description: 'Maximum time before a report generation attempt is marked as failed.', unit: 'seconds', minValue: '10', maxValue: '120' },
  { key: 'auto_report_enabled', value: 'false', dataType: 'BOOLEAN', category: 'REPORTS', label: 'Auto-generate reports', description: 'Automatically generate a collections aging report at the start of each month.' },
  { key: 'auto_report_day_of_month', value: '1', dataType: 'NUMBER', category: 'REPORTS', label: 'Auto-report day of month', description: 'Day of month on which auto-reports are generated (only applies when auto-generate is enabled).', unit: 'day', minValue: '1', maxValue: '28' },
  { key: 'auto_report_recipients', value: '[]', dataType: 'JSON', category: 'REPORTS', label: 'Auto-report recipients', description: 'Email addresses that receive auto-generated reports. Leave empty to disable email delivery.' },
  // ── WhatsApp ──────────────────────────────────────────────────────────────────
  { key: 'whatsapp_max_per_minute', value: '10', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Max messages per minute', description: 'Rate limit: maximum WhatsApp messages sent per minute to avoid Twilio throttling.', unit: 'messages/min', minValue: '1', maxValue: '60' },
  { key: 'whatsapp_nudge_window_days', value: '7', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Deadline nudge window (days)', description: 'Days before filing deadline within which bulk nudge messages are sent to clients.', unit: 'days', minValue: '1', maxValue: '30' },
  { key: 'whatsapp_quiet_hours_start', value: '22', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Quiet hours start (hour)', description: 'Hour of day (24h) after which WhatsApp messages are queued, not sent immediately.', unit: 'hour (0–23)', minValue: '0', maxValue: '23' },
  { key: 'whatsapp_quiet_hours_end', value: '8', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Quiet hours end (hour)', description: 'Hour of day (24h) after which queued messages resume sending.', unit: 'hour (0–23)', minValue: '0', maxValue: '23' },
  { key: 'whatsapp_max_per_invoice', value: '3', dataType: 'NUMBER', category: 'WHATSAPP', label: 'Max reminders per invoice', description: 'Maximum number of WhatsApp reminders sent per overdue invoice before stopping.', unit: 'count', minValue: '1', maxValue: '10' },
]

export async function seedSystemConfig(prisma: PrismaClient): Promise<void> {
  for (const row of SYSTEM_CONFIG_ROWS) {
    await prisma.systemConfig.upsert({
      where: { key: row.key },
      update: { ...row },
      create: { ...row },
    })
  }
  console.log(`  ✓ Seeded ${SYSTEM_CONFIG_ROWS.length} SystemConfig rows`)
}
