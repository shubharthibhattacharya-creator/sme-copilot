export enum ConfigKey {
  // Collections
  AGING_BUCKET_1_MAX = 'aging_bucket_1_max',
  AGING_BUCKET_2_MAX = 'aging_bucket_2_max',
  AGING_BUCKET_3_MAX = 'aging_bucket_3_max',
  RISK_WEIGHT_AGING = 'risk_weight_aging',
  RISK_WEIGHT_AMOUNT = 'risk_weight_amount',
  RISK_WEIGHT_HISTORY = 'risk_weight_history',
  RISK_THRESHOLD_HIGH = 'risk_threshold_high',
  RISK_THRESHOLD_MEDIUM = 'risk_threshold_medium',
  REMINDER_INTERVAL_DAYS = 'reminder_interval_days',
  MAX_REMINDERS_PER_INVOICE = 'max_reminders_per_invoice',
  CRITICAL_CUSTOMER_COUNT = 'critical_customer_count',
  DELAY_MULTIPLIER = 'delay_multiplier',
  COLLECTIONS_DEFAULT_PAYMENT_TERMS_DAYS = 'collections_default_payment_terms_days',

  // AI Insights
  INSIGHT_CRITICAL_OVERDUE_AMOUNT = 'insight_critical_overdue_amount',
  INSIGHT_WARNING_OVERDUE_COUNT = 'insight_warning_overdue_count',
  INSIGHT_WARNING_TREND_PERCENT = 'insight_warning_trend_percent',
  INSIGHT_TREND_WINDOW_DAYS = 'insight_trend_window_days',
  MAX_INSIGHTS_PER_REFRESH = 'max_insights_per_refresh',
  INSIGHT_MIN_SEVERITY = 'insight_min_severity',

  // GST Compliance
  GST_DEADLINE_DAY = 'gst_deadline_day',
  GST_DEADLINE_URGENCY_DAYS = 'gst_deadline_urgency_days',
  QUARTERLY_DEADLINE_MONTHS = 'quarterly_deadline_months',
  LATE_FEE_RATE_PER_DAY = 'late_fee_rate_per_day',
  GST_FILING_REMINDER_DAYS_BEFORE = 'gst_filing_reminder_days_before',
  GST_GRACE_PERIOD_DAYS = 'gst_grace_period_days',
  TDS_DEADLINE_DAY = 'tds_deadline_day',

  // Documents
  MAX_FILE_SIZE_MB = 'max_file_size_mb',
  CONFIDENCE_THRESHOLD_GREEN = 'confidence_threshold_green',
  CONFIDENCE_THRESHOLD_AMBER = 'confidence_threshold_amber',
  AUTO_REJECT_BELOW_CONFIDENCE = 'auto_reject_below_confidence',
  OCR_POLL_INTERVAL_SECONDS = 'ocr_poll_interval_seconds',
  DOCUMENT_CLASSIFICATION_MODE = 'document_classification_mode',
  DOCUMENT_REQUEST_EXPIRY_DAYS = 'document_request_expiry_days',
  DOCUMENT_OCR_MAX_RETRIES = 'document_ocr_max_retries',

  // Reports
  DEFAULT_REPORT_PERIOD = 'default_report_period',
  REPORT_POLL_INTERVAL_SECONDS = 'report_poll_interval_seconds',
  REPORT_TIMEOUT_SECONDS = 'report_timeout_seconds',
  AUTO_REPORT_ENABLED = 'auto_report_enabled',
  AUTO_REPORT_DAY_OF_MONTH = 'auto_report_day_of_month',
  AUTO_REPORT_RECIPIENTS = 'auto_report_recipients',
  REPORT_RETENTION_DAYS = 'report_retention_days',

  // Reconciliation
  RECON_TOLERANCE_TYPE = 'recon_tolerance_type',    // PERCENTAGE | FIXED
  RECON_TOLERANCE_VALUE = 'recon_tolerance_value',  // number
  RECON_AUTO_MATCH = 'recon_auto_match',            // boolean

  // WhatsApp
  WHATSAPP_MAX_PER_MINUTE = 'whatsapp_max_per_minute',
  WHATSAPP_NUDGE_WINDOW_DAYS = 'whatsapp_nudge_window_days',
  WHATSAPP_QUIET_HOURS_START = 'whatsapp_quiet_hours_start',
  WHATSAPP_QUIET_HOURS_END = 'whatsapp_quiet_hours_end',
  WHATSAPP_MAX_PER_INVOICE = 'whatsapp_max_per_invoice',
  WHATSAPP_DAILY_MESSAGE_LIMIT = 'whatsapp_daily_message_limit',
  WHATSAPP_RATE_LIMIT_PER_HOUR = 'whatsapp_rate_limit_per_hour',
  WHATSAPP_AUTO_REPLY_ENABLED = 'whatsapp_auto_reply_enabled',
}
