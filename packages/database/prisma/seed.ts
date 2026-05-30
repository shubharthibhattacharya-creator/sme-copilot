import { PrismaClient, Industry, SubscriptionPlan, UserRole, InvoiceStatus, InsightSeverity, AIModule, DocumentType, DocumentStatus, ReportType, ReportStatus, KnowledgeCategory, FilerType, FilingCategory, FilingType } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// ─── SystemConfig seed rows ───────────────────────────────────────────────────

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

const SYSTEM_CONFIG_ROWS: SystemConfigRow[] = [
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
  // ── Documents — Classification ────────────────────────────────────────────────
  { key: 'document_classification_mode', value: '"smart"', dataType: 'STRING', category: 'DOCUMENTS', label: 'Document classification mode', description: "How the system determines whether an uploaded document is your firm's fee invoice or a client's tax document. Values: smart | explicit" },
  // ── Collections — Invoice creation ───────────────────────────────────────────
  { key: 'collections_default_payment_terms_days', value: '30', dataType: 'NUMBER', category: 'COLLECTIONS', label: 'Default payment terms (days)', description: 'Number of days after invoice date before payment is due, used when creating invoices from uploaded PDFs.', unit: 'days', minValue: '1', maxValue: '365' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}
function randomAmount(min: number, max: number): Decimal {
  // Round to nearest 500 for realistic invoice amounts
  return new Decimal(Math.round(rand(min, max) / 500) * 500)
}

// ─── Seed data ────────────────────────────────────────────────────────────────

// ─── BusinessConfig overrides per industry ────────────────────────────────────
const BIZ_CONFIGS: Record<string, Partial<{
  riskWeightAging: number; riskWeightAmount: number; riskWeightHistory: number;
  riskLowThreshold: number; riskMediumThreshold: number;
  agingBucket1Days: number; agingBucket2Days: number; agingBucket3Days: number;
  maxAgingDaysForScore: number;
  criticalOverdueAmount: number; warningOverdueCount: number; warningCollectionsTrendFloor: number;
}>> = {
  CA_FIRM: {
    riskWeightAging: 0.4, riskWeightAmount: 0.35, riskWeightHistory: 0.25,
    riskLowThreshold: 0.25, riskMediumThreshold: 0.55,
    criticalOverdueAmount: 200000, warningOverdueCount: 8,
  },
  DISTRIBUTOR: {
    riskWeightAging: 0.5, riskWeightAmount: 0.3, riskWeightHistory: 0.2,
    riskLowThreshold: 0.3, riskMediumThreshold: 0.6,
    criticalOverdueAmount: 100000, warningOverdueCount: 5,
    agingBucket1Days: 15, agingBucket2Days: 30, agingBucket3Days: 45, maxAgingDaysForScore: 60,
  },
  MANUFACTURER: {
    riskWeightAging: 0.35, riskWeightAmount: 0.4, riskWeightHistory: 0.25,
    riskLowThreshold: 0.35, riskMediumThreshold: 0.65,
    criticalOverdueAmount: 500000, warningOverdueCount: 3,
    agingBucket1Days: 45, agingBucket2Days: 90, agingBucket3Days: 120, maxAgingDaysForScore: 120,
  },
}

const COMPANIES = [
  {
    name: 'Mehta & Associates CA',
    industry: Industry.CA_FIRM,
    subscriptionPlan: SubscriptionPlan.GROWTH,
    tenantConfig: {
      industryType: 'CA_FIRM',
      modulesEnabled: ['dashboard', 'collections', 'reporting', 'documents', 'assistant'],
      aiPersona: 'compliance-focused',
      whatsappEnabled: true,
      documentTypes: ['invoice', 'gst_return', 'tds_certificate', 'statement'],
      defaultCurrency: 'INR',
    },
    clerkPrefix: 'ca',
    users: [
      { name: 'Rahul Mehta', email: 'rahul@mehtaca.in', role: UserRole.ADMIN },
      { name: 'Neha Gupta', email: 'neha@mehtaca.in', role: UserRole.OPERATIONS_MANAGER },
      { name: 'Suresh Kumar', email: 'suresh@mehtaca.in', role: UserRole.STAFF },
    ],
    customers: [
      'Agarwal Textiles Ltd',
      'Patel Pharma Pvt Ltd',
      'Singh Electronics',
      'Jain Constructions',
      'Gupta Food Industries',
    ],
    inventory: [
      { sku: 'OFF-PAPER-A4', name: 'A4 Paper Ream', category: 'Stationery', unitCost: 350 },
      { sku: 'OFF-INK-BLK', name: 'Printer Ink Black', category: 'Stationery', unitCost: 1200 },
      { sku: 'OFF-FILE-ARC', name: 'Arch File', category: 'Stationery', unitCost: 85 },
      { sku: 'OFF-PEN-BOX', name: 'Pen Box (12pc)', category: 'Stationery', unitCost: 120 },
      { sku: 'OFF-STAMP-CL', name: 'Stamp Pad + Ink', category: 'Office', unitCost: 250 },
      { sku: 'OFF-BIND-M', name: 'Binding Machine', category: 'Equipment', unitCost: 4500 },
      { sku: 'OFF-USB-32G', name: 'USB Drive 32GB', category: 'IT', unitCost: 650 },
      { sku: 'OFF-TAPE-HV', name: 'Tape Dispenser Heavy', category: 'Stationery', unitCost: 180 },
      { sku: 'SOFT-TALLY-LIC', name: 'Tally License (Annual)', category: 'Software', unitCost: 18000 },
      { sku: 'OFF-CHAIR-EXC', name: 'Executive Chair', category: 'Furniture', unitCost: 12000 },
    ],
    insights: [
      { category: 'collections', severity: InsightSeverity.CRITICAL, summary: 'Patel Pharma has ₹4.2L overdue >90 days — escalate to senior partner immediately.' },
      { category: 'compliance', severity: InsightSeverity.WARNING, summary: '3 GST filings due this Friday across 5 clients — assign to ops team today.' },
      { category: 'cash_flow', severity: InsightSeverity.INFO, summary: 'Collections up 12% WoW — Agarwal Textiles cleared ₹1.8L outstanding.' },
      { category: 'collections', severity: InsightSeverity.WARNING, summary: '7 invoices >30 days aging with no reminder sent — trigger WhatsApp batch.' },
      { category: 'reporting', severity: InsightSeverity.INFO, summary: 'Q3 billing cycle closed. Total invoiced: ₹28.4L across 34 clients.' },
    ],
  },
  {
    name: 'Sharma Distributors Pvt Ltd',
    industry: Industry.DISTRIBUTOR,
    subscriptionPlan: SubscriptionPlan.STARTER,
    tenantConfig: {
      industryType: 'DISTRIBUTOR',
      modulesEnabled: ['dashboard', 'collections', 'inventory', 'whatsapp', 'reporting'],
      aiPersona: 'collections-focused',
      whatsappEnabled: true,
      documentTypes: ['invoice', 'purchase_order', 'delivery_note'],
      defaultCurrency: 'INR',
    },
    clerkPrefix: 'dist',
    users: [
      { name: 'Priya Sharma', email: 'priya@sharmadist.com', role: UserRole.ADMIN },
      { name: 'Amit Singh', email: 'amit@sharmadist.com', role: UserRole.OPERATIONS_MANAGER },
      { name: 'Ritu Agarwal', email: 'ritu@sharmadist.com', role: UserRole.STAFF },
    ],
    customers: [
      'Verma Supermart',
      'Kumar Wholesale Depot',
      'R.K. General Store',
      'Rao Brothers Enterprises',
      'Mishra Cold Storage',
    ],
    inventory: [
      { sku: 'FMCG-NSTL-500G', name: 'Noodles 2-Min 500g (Carton)', category: 'Food', unitCost: 1200 },
      { sku: 'FMCG-SURF-1KG', name: 'Detergent Powder 1kg (Carton)', category: 'Home Care', unitCost: 2400 },
      { sku: 'FMCG-BISK-AST', name: 'Biscuits Assorted (Carton 12pk)', category: 'Food', unitCost: 960 },
      { sku: 'FMCG-OIL-5L', name: 'Refined Oil 5L (Case)', category: 'Food', unitCost: 3200 },
      { sku: 'FMCG-RICE-25K', name: 'Basmati Rice 25kg', category: 'Staples', unitCost: 2800 },
      { sku: 'FMCG-TEA-500G', name: 'Chai Tea Leaves 500g (Box)', category: 'Beverages', unitCost: 1800 },
      { sku: 'FMCG-SOAP-24', name: 'Bath Soap 24-Pack', category: 'Personal Care', unitCost: 720 },
      { sku: 'FMCG-TOOTH-12', name: 'Toothpaste 150g (12-Pack)', category: 'Personal Care', unitCost: 1440 },
      { sku: 'FMCG-SHAMP-BOT', name: 'Shampoo 200ml Bottles (24pk)', category: 'Personal Care', unitCost: 1920 },
      { sku: 'FMCG-KETCH-1L', name: 'Tomato Ketchup 1L (Case 12)', category: 'Food', unitCost: 2160 },
    ],
    insights: [
      { category: 'collections', severity: InsightSeverity.CRITICAL, summary: 'R.K. General Store owes ₹3.8L overdue >60 days — send WhatsApp reminder with payment link.' },
      { category: 'inventory', severity: InsightSeverity.WARNING, summary: 'Basmati Rice (FMCG-RICE-25K) at 2-day stockout — reorder 50 bags from supplier today.' },
      { category: 'collections', severity: InsightSeverity.WARNING, summary: 'Collections down 8% WoW — Kumar Wholesale delayed ₹1.2L payment to next month.' },
      { category: 'inventory', severity: InsightSeverity.INFO, summary: 'Detergent and personal care moving 3x faster than food category — review pricing.' },
      { category: 'cash_flow', severity: InsightSeverity.INFO, summary: 'Verma Supermart cleared ₹2.1L this week. Total receivables reduced to ₹12.4L.' },
    ],
  },
  {
    name: 'Krishna Auto Parts Mfg',
    industry: Industry.MANUFACTURER,
    subscriptionPlan: SubscriptionPlan.ENTERPRISE,
    tenantConfig: {
      industryType: 'MANUFACTURER',
      modulesEnabled: ['dashboard', 'inventory', 'reporting', 'documents', 'assistant'],
      aiPersona: 'inventory-focused',
      whatsappEnabled: false,
      documentTypes: ['invoice', 'purchase_order', 'delivery_note', 'quality_report'],
      defaultCurrency: 'INR',
    },
    clerkPrefix: 'mfg',
    users: [
      { name: 'Vikram Krishna', email: 'vikram@krishnaauto.in', role: UserRole.ADMIN },
      { name: 'Anita Patel', email: 'anita@krishnaauto.in', role: UserRole.OPERATIONS_MANAGER },
      { name: 'Mohan Das', email: 'mohan@krishnaauto.in', role: UserRole.STAFF },
    ],
    customers: [
      'Shree Motors Workshop',
      'Auto Parts Express Delhi',
      'National Garage Network',
      'Sunrise Auto Services',
      'Delhi Car Accessories Hub',
    ],
    inventory: [
      { sku: 'AUTO-BRKP-FRONT', name: 'Brake Pads Front (Pair)', category: 'Brakes', unitCost: 850 },
      { sku: 'AUTO-BRKP-REAR', name: 'Brake Pads Rear (Pair)', category: 'Brakes', unitCost: 650 },
      { sku: 'AUTO-FILT-OIL', name: 'Oil Filter (Pack 10)', category: 'Filters', unitCost: 1200 },
      { sku: 'AUTO-FILT-AIR', name: 'Air Filter (Pack 6)', category: 'Filters', unitCost: 1800 },
      { sku: 'AUTO-BELT-TIMNG', name: 'Timing Belt Kit', category: 'Engine', unitCost: 3200 },
      { sku: 'AUTO-GASK-SET', name: 'Gasket Set (Engine)', category: 'Engine', unitCost: 4500 },
      { sku: 'AUTO-SPARK-4PC', name: 'Spark Plugs (Set of 4)', category: 'Ignition', unitCost: 1100 },
      { sku: 'AUTO-SHOCK-FR', name: 'Shock Absorber Front', category: 'Suspension', unitCost: 5800 },
      { sku: 'AUTO-CLUTCH-KT', name: 'Clutch Kit Assembly', category: 'Transmission', unitCost: 8500 },
      { sku: 'AUTO-HEADL-LED', name: 'LED Headlamp Assembly', category: 'Electricals', unitCost: 6200 },
    ],
    insights: [
      { category: 'inventory', severity: InsightSeverity.CRITICAL, summary: 'Brake Pad Front stock critical at 3 units — at current velocity stockout in 2 days.' },
      { category: 'inventory', severity: InsightSeverity.WARNING, summary: 'Timing Belt Kit (AUTO-BELT-TIMNG) slow-moving at 0.3 units/day — 45 days inventory.' },
      { category: 'collections', severity: InsightSeverity.WARNING, summary: 'Shree Motors has ₹6.2L overdue >45 days — largest single outstanding account.' },
      { category: 'production', severity: InsightSeverity.INFO, summary: 'Clutch Kit demand up 22% MoM — consider increasing production batch size.' },
      { category: 'inventory', severity: InsightSeverity.INFO, summary: 'Oil and Air filters have 95%+ on-time fulfillment this quarter — top-performing SKUs.' },
    ],
  },
]

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding OpsCopilot database...')

  // Clean in FK-safe order
  await prisma.assistantMessage.deleteMany()
  await prisma.assistantConversation.deleteMany()
  await prisma.knowledgeChunk.deleteMany()
  await prisma.knowledgeDocument.deleteMany()
  await prisma.whatsAppMessage.deleteMany()
  await prisma.whatsAppTemplate.deleteMany()
  await prisma.report.deleteMany()
  await prisma.documentRequest.deleteMany()
  await prisma.document.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.aIInsight.deleteMany()
  await prisma.collectionRisk.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.complianceChecklist.deleteMany()
  await prisma.filingTypeTemplate.deleteMany()
  await prisma.businessConfig.deleteMany()
  await prisma.clientConfig.deleteMany()
  await prisma.systemConfig.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()
  await prisma.company.deleteMany()

  for (const def of COMPANIES) {
    // 1. Company
    const company = await prisma.company.create({
      data: {
        name: def.name,
        industry: def.industry,
        subscriptionPlan: def.subscriptionPlan,
        tenantConfig: def.tenantConfig,
      },
    })
    console.log(`  ✓ Company: ${company.name}`)

    // 2. Users
    for (let i = 0; i < def.users.length; i++) {
      const u = def.users[i]!
      await prisma.user.create({
        data: {
          clerkId: `clerk_${def.clerkPrefix}_user_${i + 1}`,
          companyId: company.id,
          role: u.role,
          name: u.name,
          email: u.email,
        },
      })
    }

    // 3. Invoices — 20 per company, 4 per customer
    const statusPool: InvoiceStatus[] = [
      'PAID', 'PAID',
      'PENDING', 'PENDING', 'PENDING',
      'OVERDUE', 'OVERDUE', 'OVERDUE',
      'PARTIAL',
    ]

    const now = new Date()
    const invoices: Awaited<ReturnType<typeof prisma.invoice.create>>[] = []

    for (let c = 0; c < def.customers.length; c++) {
      const customerName = def.customers[c]!
      for (let j = 0; j < 4; j++) {
        const status = statusPool[(c * 4 + j) % statusPool.length] as InvoiceStatus
        const agingDays = status === 'OVERDUE' ? rand(5, 120) : status === 'PARTIAL' ? rand(10, 60) : 0
        const dueDate = new Date(now)
        dueDate.setDate(dueDate.getDate() - agingDays - rand(0, 15))

        const paidAt =
          status === 'PAID'
            ? (() => {
                const d = new Date(dueDate)
                d.setDate(d.getDate() + rand(-10, 5))
                return d
              })()
            : null

        const inv = await prisma.invoice.create({
          data: {
            companyId: company.id,
            customerName,
            customerPhone: `+919${rand(100000000, 999999999)}`,
            amount: randomAmount(10000, 500000),
            currency: 'INR',
            dueDate,
            paidAt,
            status,
            agingDays,
          },
        })
        invoices.push(inv)
      }
    }

    // 4. CollectionRisk for OVERDUE + PENDING invoices
    const riskable = invoices.filter(
      (inv) => inv.status === 'OVERDUE' || inv.status === 'PENDING',
    )
    const allAmounts = invoices.map((inv) => Number(inv.amount))
    const avgAmount = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length

    for (const inv of riskable) {
      const aging = Math.min(inv.agingDays / 90, 1) * 0.5
      const maxAmt = Math.max(Number(inv.amount), avgAmount)
      const amount = (Number(inv.amount) / maxAmt) * 0.3
      const history = Math.random() * 0.2
      const riskScore = Math.min(aging + amount + history, 1)

      await prisma.collectionRisk.create({
        data: {
          invoiceId: inv.id,
          riskScore,
          predictedDelayDays: Math.round(inv.agingDays * (1 + riskScore)),
          riskFactors: { aging, amount, history },
        },
      })
    }

    // 5. Inventory items
    for (const item of def.inventory) {
      const quantity = rand(0, 50)
      const reorderLevel = rand(5, 20)
      const velocity = Math.round(Math.random() * 30) / 10 // 0.0–3.0 units/day

      await prisma.inventoryItem.create({
        data: {
          companyId: company.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          quantity,
          reorderLevel,
          unitCost: new Decimal(item.unitCost),
          movementVelocity: velocity,
          lastMovementAt: new Date(now.getTime() - rand(0, 7) * 86400000),
        },
      })
    }

    // 6. AI Insights
    for (const ins of def.insights) {
      await prisma.aIInsight.create({
        data: {
          companyId: company.id,
          module: AIModule.DASHBOARD,
          category: ins.category,
          severity: ins.severity,
          summary: ins.summary,
          dataSnapshot: { seededAt: now.toISOString() },
        },
      })
    }

    // 7. BusinessConfig (industry-specific thresholds)
    const bizCfg = BIZ_CONFIGS[def.industry.toString()] ?? {}
    await prisma.businessConfig.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...bizCfg },
      update: bizCfg,
    })

    // 8. Seed documents (2 per company)
    const adminUser = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } })
    if (adminUser) {
      const docData: Array<{ documentType: DocumentType; status: DocumentStatus; originalName: string; storageKey: string; fileSizeBytes: number; mimeType: string; extractedData?: object; notes?: string }> = [
        {
          documentType: 'INVOICE',
          status: 'PROCESSED',
          originalName: 'invoice_Q3_2024.pdf',
          storageKey: `${company.id}/2024/09/seed-invoice-q3.pdf`,
          fileSizeBytes: 45312,
          mimeType: 'application/pdf',
          extractedData: { invoiceNumber: 'INV-2024-0892', invoiceDate: '2024-09-15', clientName: def.customers[0], totalAmount: 84000, gstAmount: 12712, confidence: 0.94 },
        },
        {
          documentType: 'GST_RETURN',
          status: 'NEEDS_REVIEW',
          originalName: 'GSTR1_Sep2024.pdf',
          storageKey: `${company.id}/2024/09/seed-gstr1-sep.pdf`,
          fileSizeBytes: 128640,
          mimeType: 'application/pdf',
          notes: 'Q2 filing — needs review before submission',
          extractedData: { gstNumber: `${company.id.slice(0, 10).toUpperCase()}Z`, filingPeriod: 'Sep 2024', totalTaxableValue: 450000, totalCGST: 40500, totalSGST: 40500, confidence: 0.78 },
        },
      ]

      for (const doc of docData) {
        await prisma.document.create({
          data: { companyId: company.id, uploadedById: adminUser.id, ...doc },
        })
      }
    }

    // 9. Seed reports (one COMPLETED, one FAILED)
    if (adminUser) {
      const periodEnd = new Date()
      const periodStart = new Date(periodEnd)
      periodStart.setDate(periodStart.getDate() - 30)

      await prisma.report.create({
        data: {
          companyId: company.id,
          generatedById: adminUser.id,
          reportType: ReportType.RECEIVABLES_SUMMARY,
          status: ReportStatus.COMPLETED,
          periodStart,
          periodEnd,
          aiSummary: `Total receivables of ₹${(rand(500000, 2000000) / 100000).toFixed(1)}L recorded in the 30-day period. Overdue accounts represent ${rand(15, 40)}% of outstanding balance. Recommend prioritising top 3 customers for immediate follow-up.`,
          dataSnapshot: {
            totalAmount: rand(500000, 2000000),
            totalInvoices: rand(15, 50),
            avgAgingDays: rand(10, 45),
            byStatus: [
              { status: 'PENDING', count: rand(5, 15), amount: rand(200000, 800000) },
              { status: 'OVERDUE', count: rand(3, 10), amount: rand(100000, 500000) },
              { status: 'PAID', count: rand(8, 20), amount: rand(300000, 1000000) },
            ],
          },
        },
      })

      await prisma.report.create({
        data: {
          companyId: company.id,
          generatedById: adminUser.id,
          reportType: ReportType.COLLECTIONS_AGING,
          status: ReportStatus.FAILED,
          periodStart,
          periodEnd,
        },
      })
    }

    // 10. Seed WhatsApp templates (4 default templates per company)
    const WA_TEMPLATES = [
      {
        key: 'fee_reminder',
        name: 'Fee payment reminder',
        body: `Dear {{clientName}},\n\nThis is a reminder that your fee of ₹{{amount}} for {{servicePeriod}} is overdue by {{agingDays}} days.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{firmName}}`,
        variables: ['clientName', 'amount', 'servicePeriod', 'agingDays', 'firmName'],
      },
      {
        key: 'doc_request',
        name: 'Document request',
        body: `Dear {{clientName}},\n\nWe require your {{documentType}} for the period {{period}} to complete your filing.\n\nPlease share the document by {{dueDate}}.\n\n{{customMessage}}\n\nRegards,\n{{firmName}}`,
        variables: ['clientName', 'documentType', 'period', 'dueDate', 'customMessage', 'firmName'],
      },
      {
        key: 'deadline_nudge',
        name: 'GST filing deadline nudge',
        body: `Dear {{clientName}},\n\nThe GST filing deadline is {{daysUntilDeadline}} days away ({{deadlineDate}}).\n\nWe are still awaiting your {{pendingDocuments}} to complete the filing.\n\nPlease submit at the earliest.\n\nRegards,\n{{firmName}}`,
        variables: ['clientName', 'daysUntilDeadline', 'deadlineDate', 'pendingDocuments', 'firmName'],
      },
      {
        key: 'payment_received',
        name: 'Payment received acknowledgement',
        body: `Dear {{clientName}},\n\nWe have received your payment of ₹{{amount}} against invoice #{{invoiceNumber}}.\n\nThank you for your prompt payment.\n\nRegards,\n{{firmName}}`,
        variables: ['clientName', 'amount', 'invoiceNumber', 'firmName'],
      },
    ]

    for (const tmpl of WA_TEMPLATES) {
      await prisma.whatsAppTemplate.upsert({
        where: { companyId_key: { companyId: company.id, key: tmpl.key } },
        update: {},
        create: { companyId: company.id, ...tmpl },
      })
    }

    // 11. Seed WhatsApp messages for the CA firm only
    if (def.industry === Industry.CA_FIRM) {
      const overdueInvoices = invoices.filter((i) => i.status === 'OVERDUE').slice(0, 4)
      const paidInvoice = invoices.find((i) => i.status === 'PAID')

      for (const inv of overdueInvoices) {
        await prisma.whatsAppMessage.create({
          data: {
            companyId: company.id,
            direction: 'OUTBOUND',
            toPhone: inv.customerPhone,
            templateKey: 'fee_reminder',
            body: `Dear ${inv.customerName},\n\nThis is a reminder that your fee of ₹${Number(inv.amount).toLocaleString('en-IN')} is overdue by ${inv.agingDays} days.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n${company.name}`,
            status: pick(['DELIVERED', 'DELIVERED', 'SENT', 'READ']),
            twilioSid: `SM${Math.random().toString(36).slice(2, 34)}`,
            sentAt: new Date(Date.now() - rand(1, 72) * 3600000),
          },
        })
      }

      if (paidInvoice) {
        await prisma.whatsAppMessage.create({
          data: {
            companyId: company.id,
            direction: 'OUTBOUND',
            toPhone: paidInvoice.customerPhone,
            templateKey: 'payment_received',
            body: `Dear ${paidInvoice.customerName},\n\nWe have received your payment of ₹${Number(paidInvoice.amount).toLocaleString('en-IN')}.\n\nThank you for your prompt payment.\n\nRegards,\n${company.name}`,
            status: 'DELIVERED',
            twilioSid: `SM${Math.random().toString(36).slice(2, 34)}`,
            sentAt: new Date(Date.now() - rand(24, 96) * 3600000),
          },
        })
      }

      // 12. Seed knowledge documents for CA firm (with chunks, no embeddings in seed)
      const GST_SOP = `# GST Monthly Filing SOP

## Overview
This SOP covers the end-to-end process for GSTR-1 and GSTR-3B filing for all clients.

## GSTR-1 Filing (Sales Return)
1. Collect all sales invoices from client by 5th of following month
2. Categorize invoices: B2B, B2C (large), B2C (small), exports
3. Upload invoices to GST portal
4. Match with e-way bills where applicable
5. File GSTR-1 before 11th of following month

## GSTR-3B Filing (Summary Return)
1. Compile input tax credit (ITC) from GSTR-2B
2. Cross-check ITC availability with client purchase records
3. Calculate net tax liability: output tax minus eligible ITC
4. Verify RCM (reverse charge mechanism) applicability
5. File GSTR-3B before 20th of following month

## Common Errors to Avoid
- Mismatch between GSTR-1 and GSTR-3B turnover figures
- Claiming ITC on blocked credits (Section 17(5) items)
- Missing e-commerce operator transactions
- Incorrect HSN code classification

## Late Filing Penalties
- GSTR-1: ₹50/day (₹20/day for NIL return), max ₹5,000
- GSTR-3B: ₹50/day (₹20/day for NIL return) + 18% interest on late tax payment`

      const TDS_SOP = `# TDS Filing and Compliance SOP

## Applicability
TDS is applicable under various sections of Income Tax Act. Key sections:
- Section 194C: Contractor payments (1-2%)
- Section 194J: Professional/technical fees (10%)
- Section 192: Salary (as per applicable slab)
- Section 194A: Interest (10%)

## Monthly TDS Process
1. Identify all TDS deductible payments made during month
2. Calculate TDS at applicable rates
3. Deposit TDS by 7th of following month (except March: 30th April)
4. Generate challan 281 for each deposit

## Quarterly TDS Returns (24Q/26Q/27Q)
- 24Q: TDS on salary
- 26Q: TDS on non-salary payments to residents
- Due dates: Q1 (31 Jul), Q2 (31 Oct), Q3 (31 Jan), Q4 (31 May)

## TDS Certificates
- Form 16: Annual certificate for salary TDS (by 15 June)
- Form 16A: Quarterly certificate for non-salary TDS (within 15 days of return filing)

## Common Issues
- Short deduction: Deducting at lower rate without valid Lower Deduction Certificate
- Non-deduction on deemed dividends or advance payments
- Mismatch between 26AS and return data
- Late deposit: Interest @ 1.5% per month from deduction to deposit date`

      const CHECKLIST = `# New Client Onboarding Checklist

## Documents Required
- [ ] PAN Card copy
- [ ] Aadhaar Card copy
- [ ] Constitution document (MOA/AOA for company, partnership deed for firm)
- [ ] GST registration certificate
- [ ] Bank account details with cancelled cheque
- [ ] Previous year ITR (last 3 years)
- [ ] Previous CA engagement letter (if switching)

## Registration Verification
1. Verify GSTIN on GST portal
2. Cross-check PAN with Income Tax portal
3. Verify company/firm registration number on MCA portal (if applicable)

## System Setup
1. Create client record in Tally with correct GST configuration
2. Upload all received documents to client folder
3. Set up GST filing calendar reminders
4. Configure TDS applicability and rates
5. Send welcome letter with service scope and fee structure

## Initial Assessment
- Review last 3 years of returns for any pending issues
- Check for pending notices from GST/Income Tax departments
- Identify rectification requirements for past filings
- Assess internal controls and accounting quality`

      for (const [title, content, category] of [
        ['GST Monthly Filing SOP', GST_SOP, KnowledgeCategory.GST_WORKFLOW],
        ['TDS Filing and Compliance SOP', TDS_SOP, KnowledgeCategory.TDS_WORKFLOW],
        ['New Client Onboarding Checklist', CHECKLIST, KnowledgeCategory.CLIENT_ONBOARDING],
      ] as [string, string, KnowledgeCategory][]) {
        const doc = await prisma.knowledgeDocument.create({
          data: { companyId: company.id, title, category, content },
        })

        // Simple chunking for seed data (no embeddings — zero vector)
        const chunkSize = 800
        const overlap = 100
        const chunks: string[] = []
        let i = 0
        while (i < content.length) {
          chunks.push(content.slice(i, i + chunkSize).trim())
          i += chunkSize - overlap
        }

        for (let ci = 0; ci < chunks.length; ci++) {
          const zeroVec = '[' + Array(1536).fill('0').join(',') + ']'
          await prisma.$executeRaw`
            INSERT INTO "knowledge_chunks" ("id", "documentId", "companyId", "chunkIndex", "content", "embedding", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              ${doc.id},
              ${company.id},
              ${ci},
              ${chunks[ci]!},
              ${zeroVec}::vector,
              NOW()
            )
          `
        }
      }
    }

    console.log(
      `  ✓ ${def.users.length} users, ${invoices.length} invoices, ` +
      `${riskable.length} risk scores, ${def.inventory.length} inventory items, ` +
      `${def.insights.length} insights, BusinessConfig, 2 docs, 2 reports, ` +
      `${WA_TEMPLATES.length} WA templates` +
      (def.industry === Industry.CA_FIRM ? ', WA messages, 3 knowledge docs' : ''),
    )
  }

  // ── Seed SystemConfig (global, not per-company) ──────────────────────────────
  for (const row of SYSTEM_CONFIG_ROWS) {
    await prisma.systemConfig.upsert({
      where: { key: row.key },
      update: { ...row },
      create: { ...row },
    })
  }
  console.log(`  ✓ Seeded ${SYSTEM_CONFIG_ROWS.length} SystemConfig rows`)

  // ── Seed Clients for Mehta & Associates only ─────────────────────────────────
  const mehtaCompany = await prisma.company.findFirst({ where: { name: 'Mehta & Associates CA' } })
  const mehtaAdmin = mehtaCompany
    ? await prisma.user.findFirst({ where: { companyId: mehtaCompany.id, role: UserRole.ADMIN } })
    : null

  if (mehtaCompany && mehtaAdmin) {
    const MEHTA_CLIENTS = [
      {
        name: 'Agarwal Textiles Ltd',
        gstin: '07AAACA1234A1Z5',
        pan: 'AAACA1234A',
        contactPerson: 'Ramesh Agarwal',
        phone: '+919876543210',
        email: 'ramesh@agartex.in',
        filerType: FilerType.MONTHLY,
        filingCategory: FilingCategory.REGULAR,
        serviceScope: ['GST_FILING', 'TDS', 'ITR'],
      },
      {
        name: 'Patel Pharma Pvt Ltd',
        gstin: '27AABCP5678B1Z3',
        pan: 'AABCP5678B',
        contactPerson: 'Sunil Patel',
        phone: '+919765432101',
        email: 'sunil@patelpharma.com',
        filerType: FilerType.MONTHLY,
        filingCategory: FilingCategory.REGULAR,
        serviceScope: ['GST_FILING', 'TDS', 'AUDIT'],
      },
      {
        name: 'Singh Electronics',
        gstin: '06AAHCS9012C1Z1',
        pan: 'AAHCS9012C',
        contactPerson: 'Gurpreet Singh',
        phone: '+919654321012',
        email: 'gurpreet@singhelectronics.in',
        filerType: FilerType.QUARTERLY,
        filingCategory: FilingCategory.REGULAR,
        serviceScope: ['GST_FILING', 'ITR'],
      },
      {
        name: 'Jain Constructions',
        gstin: '08AAECJ3456D1Z7',
        pan: 'AAECJ3456D',
        contactPerson: 'Mahesh Jain',
        phone: '+919543210123',
        email: 'mahesh@jainconstruct.in',
        filerType: FilerType.MONTHLY,
        filingCategory: FilingCategory.REGULAR,
        serviceScope: ['GST_FILING', 'TDS', 'AUDIT', 'ITR'],
      },
      {
        name: 'Gupta Food Industries',
        gstin: '09AACFG7890E1Z9',
        pan: 'AACFG7890E',
        contactPerson: 'Dinesh Gupta',
        phone: '+919432101234',
        email: 'dinesh@guptafood.in',
        filerType: FilerType.MONTHLY,
        filingCategory: FilingCategory.COMPOSITION,
        serviceScope: ['GST_FILING', 'ITR'],
      },
    ]

    for (const clientData of MEHTA_CLIENTS) {
      await prisma.client.upsert({
        where: { companyId_gstin: { companyId: mehtaCompany.id, gstin: clientData.gstin } },
        update: {},
        create: { companyId: mehtaCompany.id, ...clientData },
      })
    }
    console.log(`  ✓ Seeded ${MEHTA_CLIENTS.length} Clients for Mehta & Associates`)

    // 2 ClientConfig overrides for Mehta & Associates
    const CLIENT_CONFIG_OVERRIDES = [
      { key: 'gst_deadline_day', value: '18' },
      { key: 'critical_customer_count', value: '5' },
    ]

    for (const cfg of CLIENT_CONFIG_OVERRIDES) {
      await prisma.clientConfig.upsert({
        where: { companyId_key: { companyId: mehtaCompany.id, key: cfg.key } },
        update: { value: cfg.value, updatedBy: mehtaAdmin.id },
        create: { companyId: mehtaCompany.id, key: cfg.key, value: cfg.value, updatedBy: mehtaAdmin.id },
      })
    }
    console.log(`  ✓ Seeded ${CLIENT_CONFIG_OVERRIDES.length} ClientConfig overrides for Mehta & Associates`)

    // Filing Type Templates for CA firm
    const FILING_TEMPLATES: Array<{
      filingType: FilingType
      label: string
      requiredDocTypes: string[]
      minDocCounts: Record<string, number>
    }> = [
      {
        filingType: FilingType.GST_MONTHLY,
        label: 'GST Monthly Filing (GSTR-1 + GSTR-3B)',
        requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
        minDocCounts: { INVOICE: 1, BANK_STATEMENT: 1 },
      },
      {
        filingType: FilingType.GST_QUARTERLY,
        label: 'GST Quarterly Filing (QRMP)',
        requiredDocTypes: ['INVOICE', 'BANK_STATEMENT', 'GST_RETURN'],
        minDocCounts: { INVOICE: 1, BANK_STATEMENT: 1 },
      },
      {
        filingType: FilingType.TDS_QUARTERLY,
        label: 'TDS Quarterly Return (26Q/24Q)',
        requiredDocTypes: ['TDS_CERTIFICATE', 'BANK_STATEMENT'],
        minDocCounts: { TDS_CERTIFICATE: 1, BANK_STATEMENT: 1 },
      },
      {
        filingType: FilingType.ITR_ANNUAL,
        label: 'Income Tax Return (Annual)',
        requiredDocTypes: ['FORM_16', 'BANK_STATEMENT'],
        minDocCounts: { FORM_16: 1, BANK_STATEMENT: 1 },
      },
    ]

    for (const tmpl of FILING_TEMPLATES) {
      await prisma.filingTypeTemplate.upsert({
        where: { companyId_filingType: { companyId: mehtaCompany.id, filingType: tmpl.filingType } },
        update: {},
        create: { companyId: mehtaCompany.id, ...tmpl },
      })
    }
    console.log(`  ✓ Seeded ${FILING_TEMPLATES.length} FilingTypeTemplates for Mehta & Associates`)
  }

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
