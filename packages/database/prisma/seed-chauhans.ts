/**
 * Additive seed script — Chauhans Tax Consultants
 *
 * Finds the company whose name contains "chauhan" (case-insensitive),
 * then ADDS sample data for every module without touching other tenants.
 *
 * Run:
 *   pnpm --filter @opsc/database db:seed:chauhans
 */

import { Prisma, PrismaClient,
  FilerType,
  FilingCategory,
  FilingType,
  InvoiceStatus,
  AIModule,
  InsightSeverity,
  DocumentType,
  DocumentStatus,
  ChecklistStatus,
  ReportType,
  ReportStatus,
  KnowledgeCategory,
  MessageDirection,
  MessageStatus,
  SyncStatus,
  DocumentOwner,
  DocumentPurpose,
  SourceChannel,
  Gstr2bFileFormat,
} from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

// ─── helpers ──────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(arr: T[]): T { return arr[rand(0, arr.length - 1)]! }
function daysAgo(n: number): Date { const d = new Date(); d.setDate(d.getDate() - n); return d }
function daysFrom(n: number): Date { const d = new Date(); d.setDate(d.getDate() + n); return d }
function amount(min: number, max: number): Decimal {
  return new Decimal(Math.round(rand(min, max) / 500) * 500)
}

// ─── clients ──────────────────────────────────────────────────────────────────
const CLIENTS = [
  {
    name: 'Raj Exports Pvt Ltd',
    gstin: '07AABCR1234A1Z5',
    pan: 'AABCR1234A',
    contactPerson: 'Arvind Raj',
    phone: '+919876001001',
    email: 'arvind@rajexports.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'TDS', 'ITR'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.TDS_QUARTERLY, FilingType.ITR_ANNUAL],
  },
  {
    name: 'Sharma Retail Pvt Ltd',
    gstin: '27AAHCS5678B1Z3',
    pan: 'AAHCS5678B',
    contactPerson: 'Sunita Sharma',
    phone: '+919876002002',
    email: 'sunita@sharmaretail.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'AUDIT'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.ITR_ANNUAL],
  },
  {
    name: 'Kapoor & Sons Construction',
    gstin: '08AAECK3456C1Z7',
    pan: 'AAECK3456C',
    contactPerson: 'Deepak Kapoor',
    phone: '+919876003003',
    email: 'deepak@kapoorconstruct.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'TDS', 'AUDIT', 'ITR'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.TDS_QUARTERLY, FilingType.ITR_ANNUAL],
  },
  {
    name: 'Verma IT Solutions',
    gstin: '29AABPV7890D1Z1',
    pan: 'AABPV7890D',
    contactPerson: 'Rohit Verma',
    phone: '+919876004004',
    email: 'rohit@vermait.in',
    filerType: FilerType.QUARTERLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'TDS', 'ITR'],
    gstDeadlineDay: 22,
    filingTypes: [FilingType.GST_QUARTERLY, FilingType.TDS_QUARTERLY, FilingType.ITR_ANNUAL],
  },
  {
    name: 'Malhotra Fine Jewellers',
    gstin: '07AADPM2345E1Z9',
    pan: 'AADPM2345E',
    contactPerson: 'Harish Malhotra',
    phone: '+919876005005',
    email: 'harish@malhotrajewels.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.COMPOSITION,
    serviceScope: ['GST_FILING', 'ITR'],
    gstDeadlineDay: 18,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.ITR_ANNUAL],
  },
  {
    name: 'Sunrise Hospitality Pvt Ltd',
    gstin: '19AABCS9012F1Z5',
    pan: 'AABCS9012F',
    contactPerson: 'Meena Saxena',
    phone: '+919876006006',
    email: 'meena@sunrisehospitality.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'TDS', 'AUDIT'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.TDS_QUARTERLY],
  },
  {
    name: 'Delhi Auto Components',
    gstin: '07AABCD4567G1Z3',
    pan: 'AABCD4567G',
    contactPerson: 'Suresh Dhingra',
    phone: '+919876007007',
    email: 'suresh@delhiauto.in',
    filerType: FilerType.MONTHLY,
    filingCategory: FilingCategory.REGULAR,
    serviceScope: ['GST_FILING', 'TDS'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_MONTHLY, FilingType.TDS_QUARTERLY],
  },
  {
    name: 'Bharat Organic Farms',
    gstin: '09AABPB8901H1Z7',
    pan: 'AABPB8901H',
    contactPerson: 'Prakash Bhardwaj',
    phone: '+919876008008',
    email: 'prakash@bharatorganic.in',
    filerType: FilerType.QUARTERLY,
    filingCategory: FilingCategory.EXEMPT,
    serviceScope: ['GST_FILING', 'ITR'],
    gstDeadlineDay: 20,
    filingTypes: [FilingType.GST_QUARTERLY, FilingType.ITR_ANNUAL],
  },
]

// ─── invoice scenarios per client (status, agingDays, amountRange) ────────────
type InvSpec = { status: InvoiceStatus; agingDays: number; min: number; max: number; invoiceDate: Date }

function buildInvoiceSpecs(): Record<string, InvSpec[]> {
  const now = new Date()
  return {
    'Raj Exports Pvt Ltd': [
      { status: 'OVERDUE', agingDays: 47, min: 85000, max: 180000, invoiceDate: daysAgo(77) },
      { status: 'PENDING', agingDays: 0, min: 120000, max: 250000, invoiceDate: daysAgo(15) },
      { status: 'PAID', agingDays: 0, min: 65000, max: 95000, invoiceDate: daysAgo(60) },
      { status: 'PARTIAL', agingDays: 22, min: 150000, max: 320000, invoiceDate: daysAgo(52) },
    ],
    'Sharma Retail Pvt Ltd': [
      { status: 'PAID', agingDays: 0, min: 45000, max: 90000, invoiceDate: daysAgo(50) },
      { status: 'PAID', agingDays: 0, min: 38000, max: 72000, invoiceDate: daysAgo(35) },
      { status: 'PENDING', agingDays: 0, min: 55000, max: 110000, invoiceDate: daysAgo(20) },
      { status: 'OVERDUE', agingDays: 18, min: 62000, max: 125000, invoiceDate: daysAgo(48) },
    ],
    'Kapoor & Sons Construction': [
      { status: 'OVERDUE', agingDays: 93, min: 280000, max: 520000, invoiceDate: daysAgo(123) },
      { status: 'OVERDUE', agingDays: 61, min: 175000, max: 350000, invoiceDate: daysAgo(91) },
      { status: 'PARTIAL', agingDays: 38, min: 220000, max: 420000, invoiceDate: daysAgo(68) },
      { status: 'PENDING', agingDays: 0, min: 145000, max: 290000, invoiceDate: daysAgo(22) },
    ],
    'Verma IT Solutions': [
      { status: 'PAID', agingDays: 0, min: 55000, max: 100000, invoiceDate: daysAgo(90) },
      { status: 'PENDING', agingDays: 0, min: 70000, max: 130000, invoiceDate: daysAgo(30) },
      { status: 'OVERDUE', agingDays: 28, min: 85000, max: 165000, invoiceDate: daysAgo(58) },
      { status: 'PAID', agingDays: 0, min: 60000, max: 110000, invoiceDate: daysAgo(120) },
    ],
    'Malhotra Fine Jewellers': [
      { status: 'PAID', agingDays: 0, min: 25000, max: 55000, invoiceDate: daysAgo(45) },
      { status: 'PENDING', agingDays: 0, min: 28000, max: 60000, invoiceDate: daysAgo(18) },
      { status: 'OVERDUE', agingDays: 14, min: 32000, max: 68000, invoiceDate: daysAgo(44) },
      { status: 'PAID', agingDays: 0, min: 22000, max: 48000, invoiceDate: daysAgo(75) },
    ],
    'Sunrise Hospitality Pvt Ltd': [
      { status: 'OVERDUE', agingDays: 112, min: 320000, max: 650000, invoiceDate: daysAgo(142) },
      { status: 'OVERDUE', agingDays: 74, min: 185000, max: 380000, invoiceDate: daysAgo(104) },
      { status: 'OVERDUE', agingDays: 45, min: 210000, max: 430000, invoiceDate: daysAgo(75) },
      { status: 'PARTIAL', agingDays: 28, min: 160000, max: 320000, invoiceDate: daysAgo(58) },
    ],
    'Delhi Auto Components': [
      { status: 'PAID', agingDays: 0, min: 35000, max: 75000, invoiceDate: daysAgo(55) },
      { status: 'OVERDUE', agingDays: 32, min: 48000, max: 98000, invoiceDate: daysAgo(62) },
      { status: 'PENDING', agingDays: 0, min: 42000, max: 88000, invoiceDate: daysAgo(25) },
      { status: 'PAID', agingDays: 0, min: 38000, max: 82000, invoiceDate: daysAgo(80) },
    ],
    'Bharat Organic Farms': [
      { status: 'PAID', agingDays: 0, min: 18000, max: 38000, invoiceDate: daysAgo(90) },
      { status: 'PENDING', agingDays: 0, min: 22000, max: 46000, invoiceDate: daysAgo(35) },
      { status: 'OVERDUE', agingDays: 21, min: 25000, max: 52000, invoiceDate: daysAgo(51) },
      { status: 'PAID', agingDays: 0, min: 20000, max: 42000, invoiceDate: daysAgo(130) },
    ],
  }
}

// ─── WA templates ─────────────────────────────────────────────────────────────
const WA_TEMPLATES = [
  {
    key: 'fee_reminder',
    name: 'Fee payment reminder',
    body: `Dear {{clientName}},\n\nThis is a reminder that your professional fee of ₹{{amount}} for {{servicePeriod}} is overdue by {{agingDays}} days.\n\nKindly arrange the payment at your earliest convenience.\n\nFor any queries please call us.\n\nRegards,\nChauhans Tax Consultants`,
    variables: ['clientName', 'amount', 'servicePeriod', 'agingDays'],
  },
  {
    key: 'doc_request',
    name: 'Document request',
    body: `Dear {{clientName}},\n\nWe require your {{documentType}} for {{period}} to proceed with your filing.\n\nKindly share the document by {{dueDate}}. You can also upload it at the secure link we shared earlier.\n\nRegards,\nChauhans Tax Consultants`,
    variables: ['clientName', 'documentType', 'period', 'dueDate'],
  },
  {
    key: 'deadline_nudge',
    name: 'GST filing deadline nudge',
    body: `Dear {{clientName}},\n\nYour GST filing deadline is on {{deadlineDate}} ({{daysUntilDeadline}} days away).\n\nWe still need: {{pendingDocuments}}\n\nPlease submit these documents at the earliest to avoid late fees of ₹50/day.\n\nRegards,\nChauhans Tax Consultants`,
    variables: ['clientName', 'deadlineDate', 'daysUntilDeadline', 'pendingDocuments'],
  },
  {
    key: 'payment_received',
    name: 'Payment acknowledgement',
    body: `Dear {{clientName}},\n\nWe acknowledge receipt of ₹{{amount}} against invoice #{{invoiceNumber}}. Thank you for the timely payment.\n\nYour next billing date is {{nextBillingDate}}.\n\nRegards,\nChauhans Tax Consultants`,
    variables: ['clientName', 'amount', 'invoiceNumber', 'nextBillingDate'],
  },
]

// ─── AI insights ──────────────────────────────────────────────────────────────
const INSIGHTS = [
  {
    category: 'collections',
    severity: InsightSeverity.CRITICAL,
    summary: 'Sunrise Hospitality has ₹11.5L+ overdue across 3 invoices (45–112 days aging) — escalate to senior partner and consider legal notice.',
  },
  {
    category: 'collections',
    severity: InsightSeverity.CRITICAL,
    summary: 'Kapoor & Sons has ₹4.7L+ overdue >60 days. Two invoices unanswered — schedule in-person visit this week.',
  },
  {
    category: 'compliance',
    severity: InsightSeverity.WARNING,
    summary: 'GST deadline (20 Jun) is 20 days away — 3 monthly clients (Raj Exports, Sharma Retail, Kapoor) have pending documents.',
  },
  {
    category: 'collections',
    severity: InsightSeverity.WARNING,
    summary: 'WhatsApp reminder sent to 4 overdue clients — 2 delivered, 1 read, 1 failed (invalid number for Sunrise Hospitality).',
  },
  {
    category: 'cash_flow',
    severity: InsightSeverity.INFO,
    summary: 'Sharma Retail cleared ₹1.28L this week. Collections up 9% WoW — momentum to maintain.',
  },
  {
    category: 'compliance',
    severity: InsightSeverity.INFO,
    summary: 'Verma IT Solutions GST quarterly return for Jan–Mar 2026 filed on time. Readiness score was 100% — model client.',
  },
]

// ─── Knowledge documents ───────────────────────────────────────────────────────
const KNOWLEDGE_DOCS: Array<{ title: string; category: KnowledgeCategory; content: string }> = [
  {
    title: 'GST Monthly Filing SOP',
    category: KnowledgeCategory.GST_WORKFLOW,
    content: `# GST Monthly Filing SOP — Chauhans Tax Consultants

## Overview
This SOP covers the complete GSTR-1 and GSTR-3B filing process for all monthly-filer clients. Deadline: 20th of the following month for GSTR-3B, 11th for GSTR-1.

## Step 1 — Document Collection (by 5th of month)
- Collect all sales invoices from client
- Collect purchase invoices for ITC reconciliation
- Collect bank statement for the month
- Request e-way bill report if applicable
- Follow up via WhatsApp (template: doc_request) if not received by 3rd

## Step 2 — GSTR-1 Preparation (by 8th)
1. Categorise invoices: B2B, B2C Large (>₹2.5L), B2C Small, Exports, Nil-rated
2. Verify GSTIN of all B2B buyers on GST portal
3. Map invoices to correct HSN/SAC codes (8-digit for turnover >₹5Cr, 4-digit otherwise)
4. Upload to GST portal using JSON utility or direct portal entry
5. Cross-verify with e-way bills where applicable
6. File GSTR-1 before 11th

## Step 3 — GSTR-3B Preparation (by 17th)
1. Download GSTR-2B from portal (auto-generated ITC credit)
2. Compare GSTR-2B ITC with purchase register — flag mismatches
3. Apply Section 17(5) blocked credit exclusions
4. Calculate net tax: Output GST – Eligible ITC
5. Verify RCM (Reverse Charge) applicability for specified services
6. Confirm cash balance in Electronic Cash Ledger before filing

## Step 4 — Filing and Payment (by 20th)
1. File GSTR-3B and generate ARN (Acknowledgement Reference Number)
2. Save ARN in client folder in Documents module
3. Mark checklist as FILED in compliance module
4. Send WhatsApp payment_received template with filing confirmation

## Common Errors
- Mismatch in turnover between GSTR-1 and GSTR-3B
- Claiming ITC on blocked credits (Section 17(5)): motor vehicles, food, beauty services
- Missing reverse charge on import of services
- Incorrect GSTIN mapping for branch transactions

## Late Fees
- GSTR-1: ₹50/day (₹20/day for NIL), max ₹5,000
- GSTR-3B: ₹50/day (₹20/day for NIL) + 18% p.a. interest on delayed payment`,
  },
  {
    title: 'TDS Compliance SOP',
    category: KnowledgeCategory.TDS_WORKFLOW,
    content: `# TDS Filing and Compliance SOP — Chauhans Tax Consultants

## Key TDS Sections for Our Clients

| Section | Nature of Payment | Rate |
|---------|------------------|------|
| 194C | Contractor/sub-contractor payments | 1% (individual), 2% (company) |
| 194J | Professional/technical fees | 10% (2% for technical fees w.e.f 2020) |
| 194I | Rent (land/building) | 10% (2% for plant/machinery) |
| 192 | Salary | As per slab rates |
| 194A | Interest (non-bank) | 10% |
| 194H | Commission/brokerage | 5% |
| 194Q | Purchase of goods (>₹50L) | 0.1% |

## Monthly TDS Calendar
- **7th of following month**: Deposit TDS challan (Challan 281) except March
- **30th April**: Deposit TDS for March deductions
- **7th of every month**: Generate Form 16A data for quarterly issue

## Quarterly TDS Return Schedule
| Quarter | Period | Due Date |
|---------|--------|----------|
| Q1 | Apr–Jun | 31 July |
| Q2 | Jul–Sep | 31 October |
| Q3 | Oct–Dec | 31 January |
| Q4 | Jan–Mar | 31 May |

## Return Forms
- **24Q**: TDS on salary (filed quarterly, corrected annually)
- **26Q**: TDS on non-salary payments to residents
- **27Q**: TDS on payments to non-residents

## TDS Certificates
- **Form 16**: Annual (by 15 June) — salary TDS certificate
- **Form 16A**: Quarterly (within 15 days of return due date) — non-salary TDS
- Download from TRACES portal and share with client

## Lower Deduction Certificates
- Clients can apply for Form 13 on Income Tax portal for lower/nil deduction
- Validate LDC certificate before applying lower rate
- Keep copy on file

## Common Issues at Chauhans
- Kapoor & Sons: High contractor payments — ensure 194C deducted on all sub-contractor bills
- Verma IT: 194J applies at 2% for software development services (technical) not 10%
- Sunrise Hospitality: 194I on rent payments to landlord — verify threshold (₹2.4L annual)`,
  },
  {
    title: 'New Client Onboarding SOP',
    category: KnowledgeCategory.CLIENT_ONBOARDING,
    content: `# New Client Onboarding Checklist — Chauhans Tax Consultants

## Documents to Collect
- [ ] PAN Card (individual / company)
- [ ] Aadhaar Card (individual proprietor)
- [ ] GST Registration Certificate (RC)
- [ ] MOA + AOA (for Private Limited) or Partnership Deed (for firm)
- [ ] Latest 3 years ITR copies
- [ ] Previous CA's No-Objection letter (if switching)
- [ ] Cancelled cheque (bank account verification)
- [ ] Digital Signature Certificate (if available)

## Verification Steps
1. **GSTIN verification**: Check on GST portal — verify name match, state code, filing status
2. **PAN verification**: Cross-check with Income Tax portal
3. **MCA verification**: For companies — check ROC status, director details
4. **Outstanding dues check**: Check for pending GSTN notices, demand orders
5. **Previous return review**: Last 3 returns for errors, late fees, pending reconciliation

## System Setup
1. Create client profile in OpsCopilot with correct GSTIN, PAN, filer type
2. Set gstDeadlineDay (default: 20 for monthly, 22 for quarterly)
3. Upload all collected documents to client's document folder
4. Create compliance checklists for current + upcoming filing period
5. Add client's phone number for WhatsApp reminders
6. Send welcome message via WhatsApp (template: welcome_onboard)

## Engagement Letter
- Issue engagement letter defining scope of services
- Confirm fee structure and payment terms
- Specify due date for document submission (typically 5th of each month)
- Get signed copy on file

## First Month Special Steps
- Review last 3 years returns for carryforward items (unadjusted losses, ITC credits)
- Check for any outstanding notices from GST/IT department
- Reconcile opening ITC balance with GSTR-2B
- Verify e-invoicing applicability (mandatory if turnover >₹5Cr)
- Assess need for e-way bill setup`,
  },
]

// ─── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding Chauhans sample data...\n')

  // ── 1. Find company ──────────────────────────────────────────────────────────
  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  console.log('Companies in DB:', companies.map((c) => `"${c.name}"`).join(', '))

  const targetName = process.env['SEED_COMPANY_NAME']
  let company = targetName
    ? companies.find((c) => c.name.toLowerCase() === targetName.toLowerCase())
    : companies.find((c) => c.name.toLowerCase().includes('chauhan'))

  if (!company) {
    const createName = targetName ?? 'Chauhans Tax Consultants'
    console.log(`  ⚙️  Company "${createName}" not found — creating it now...`)
    const created = await prisma.company.create({
      data: {
        name: createName,
        industry: 'CA_FIRM',
        subscriptionPlan: 'GROWTH',
        tenantConfig: {
          industryType: 'CA_FIRM',
          modulesEnabled: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'compliance', 'settings'],
          aiPersona: 'compliance-focused',
          whatsappEnabled: true,
          documentTypes: ['invoice', 'gst_return', 'tds_certificate', 'bank_statement', 'form_16'],
          defaultCurrency: 'INR',
          onboardingCompleted: true,
        },
      },
    })
    // Create a seed admin user
    await prisma.user.create({
      data: {
        clerkId: 'clerk_chauhans_admin_1',
        companyId: created.id,
        role: 'ADMIN',
        name: 'Ravi Chauhan',
        email: 'ravi@chauhanstax.in',
        moduleAccess: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'compliance', 'settings'],
      },
    })
    company = created
    console.log(`  ✓ Created company + admin user`)
  }
  console.log(`\n✓ Found company: "${company.name}" (${company.id})\n`)

  // ── 2. Find admin user ───────────────────────────────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { companyId: company.id, role: 'ADMIN', isActive: true },
  })
  if (!adminUser) {
    console.error('❌ No ADMIN user found for this company. Aborting.')
    return
  }
  const staffUser = await prisma.user.findFirst({
    where: { companyId: company.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })
  const userId = adminUser.id
  const staffId = staffUser?.id ?? userId
  console.log(`✓ Admin user: ${adminUser.name} (${adminUser.email})`)

  // ── 3. Update company to GROWTH plan + all modules ───────────────────────────
  await prisma.company.update({
    where: { id: company.id },
    data: {
      subscriptionPlan: 'GROWTH',
      industry: 'CA_FIRM',
      tenantConfig: {
        industryType: 'CA_FIRM',
        modulesEnabled: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'compliance', 'settings'],
        aiPersona: 'compliance-focused',
        whatsappEnabled: true,
        documentTypes: ['invoice', 'gst_return', 'tds_certificate', 'bank_statement', 'form_16'],
        defaultCurrency: 'INR',
        onboardingCompleted: true,
      },
    },
  })
  console.log('✓ Company updated: GROWTH plan, CA_FIRM, all modules enabled')

  // ── 4. BusinessConfig ────────────────────────────────────────────────────────
  await prisma.businessConfig.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      riskWeightAging: 0.4,
      riskWeightAmount: 0.35,
      riskWeightHistory: 0.25,
      riskLowThreshold: 0.25,
      riskMediumThreshold: 0.55,
      agingBucket1Days: 30,
      agingBucket2Days: 60,
      agingBucket3Days: 90,
      maxAgingDaysForScore: 90,
      criticalOverdueAmount: 200000,
      warningOverdueCount: 8,
      warningCollectionsTrendFloor: -10,
    },
    update: {},
  })
  console.log('✓ BusinessConfig seeded')

  // ── 5. Clients ───────────────────────────────────────────────────────────────
  const clientMap = new Map<string, string>() // name → id
  for (const cl of CLIENTS) {
    const existing = await prisma.client.findFirst({
      where: { companyId: company.id, gstin: cl.gstin },
    })
    let clientId: string
    if (existing) {
      clientId = existing.id
    } else {
      const created = await prisma.client.create({
        data: {
          companyId: company.id,
          name: cl.name,
          gstin: cl.gstin,
          pan: cl.pan,
          contactPerson: cl.contactPerson,
          phone: cl.phone,
          email: cl.email,
          filerType: cl.filerType,
          filingCategory: cl.filingCategory,
          serviceScope: cl.serviceScope,
          gstDeadlineDay: cl.gstDeadlineDay,
          filingTypes: cl.filingTypes,
        },
      })
      clientId = created.id
    }
    clientMap.set(cl.name, clientId)
  }
  console.log(`✓ ${CLIENTS.length} clients seeded`)

  // ── 6. Invoices + CollectionRisk ─────────────────────────────────────────────
  const invoiceSpecs = buildInvoiceSpecs()
  const invoiceMap = new Map<string, string[]>() // clientName → invoice ids
  let totalInvoices = 0
  let totalRisks = 0

  for (const cl of CLIENTS) {
    const clientId = clientMap.get(cl.name)!
    const specs = invoiceSpecs[cl.name] ?? []
    const ids: string[] = []

    for (const spec of specs) {
      const dueDate = new Date(spec.invoiceDate)
      dueDate.setDate(dueDate.getDate() + 30)

      const paidAt = spec.status === 'PAID'
        ? new Date(dueDate.getTime() - rand(1, 10) * 86400000)
        : null

      const inv = await prisma.invoice.create({
        data: {
          companyId: company.id,
          clientId,
          customerName: cl.name,
          customerPhone: cl.phone,
          amount: amount(spec.min, spec.max),
          currency: 'INR',
          dueDate,
          paidAt,
          status: spec.status,
          agingDays: spec.agingDays,
          invoiceDate: spec.invoiceDate,
          invoiceNumber: `CHAU-${new Date().getFullYear()}-${String(rand(1000, 9999))}`,
          description: `Professional services — ${cl.serviceScope[0]}`,
        },
      })
      ids.push(inv.id)
      totalInvoices++

      // risk for OVERDUE and PENDING
      if (spec.status === 'OVERDUE' || spec.status === 'PENDING') {
        const aging = Math.min(spec.agingDays / 90, 1) * 0.4
        const amtFactor = Math.min(spec.max / 600000, 1) * 0.35
        const history = Math.random() * 0.25
        const riskScore = Math.min(aging + amtFactor + history, 1)
        await prisma.collectionRisk.create({
          data: {
            invoiceId: inv.id,
            riskScore,
            predictedDelayDays: Math.round(spec.agingDays * (1 + riskScore) + rand(5, 20)),
            riskFactors: { aging, amount: amtFactor, history },
          },
        })
        totalRisks++
      }
    }
    invoiceMap.set(cl.name, ids)
  }
  console.log(`✓ ${totalInvoices} invoices seeded, ${totalRisks} risk scores`)

  // ── 6b. Monthly trend invoices (Jan–Jun 2026) — backdated for sparklines + WoW ──
  {
    interface MonthlyInv {
      customerIdx: number
      status: InvoiceStatus
      amount: number
      daysOverdue?: number
      paidDaysAgo?: number
    }
    interface MonthDef { year: number; month: number; invoices: MonthlyInv[] }

    const now = new Date()
    const MONTHLY_DATA: MonthDef[] = [
      // ── January 2026 ──
      { year: 2026, month: 0, invoices: [
        { customerIdx: 0, status: 'PAID',    amount: 55000,  paidDaysAgo: 155 },
        { customerIdx: 1, status: 'PAID',    amount: 42000,  paidDaysAgo: 148 },
        { customerIdx: 2, status: 'PAID',    amount: 85000,  paidDaysAgo: 162 },
        { customerIdx: 3, status: 'PAID',    amount: 48000,  paidDaysAgo: 151 },
        { customerIdx: 5, status: 'OVERDUE', amount: 75000,  daysOverdue: 140 },
      ]},
      // ── February 2026 ──
      { year: 2026, month: 1, invoices: [
        { customerIdx: 0, status: 'PAID',    amount: 62000,  paidDaysAgo: 118 },
        { customerIdx: 2, status: 'PAID',    amount: 95000,  paidDaysAgo: 110 },
        { customerIdx: 4, status: 'PAID',    amount: 32000,  paidDaysAgo: 115 },
        { customerIdx: 6, status: 'PAID',    amount: 45000,  paidDaysAgo: 120 },
        { customerIdx: 5, status: 'OVERDUE', amount: 185000, daysOverdue: 108 },
      ]},
      // ── March 2026 — ITR season peak ──
      { year: 2026, month: 2, invoices: [
        { customerIdx: 0, status: 'PAID',    amount: 85000,  paidDaysAgo: 85 },
        { customerIdx: 1, status: 'PAID',    amount: 68000,  paidDaysAgo: 82 },
        { customerIdx: 2, status: 'PAID',    amount: 145000, paidDaysAgo: 91 },
        { customerIdx: 3, status: 'PAID',    amount: 78000,  paidDaysAgo: 88 },
        { customerIdx: 4, status: 'PAID',    amount: 45000,  paidDaysAgo: 79 },
        { customerIdx: 6, status: 'PAID',    amount: 55000,  paidDaysAgo: 85 },
        { customerIdx: 7, status: 'PAID',    amount: 28000,  paidDaysAgo: 92 },
        { customerIdx: 5, status: 'OVERDUE', amount: 210000, daysOverdue: 75 },
      ]},
      // ── April 2026 ──
      { year: 2026, month: 3, invoices: [
        { customerIdx: 0, status: 'PAID',    amount: 75000,  paidDaysAgo: 50 },
        { customerIdx: 1, status: 'PAID',    amount: 58000,  paidDaysAgo: 43 },
        { customerIdx: 3, status: 'PAID',    amount: 88000,  paidDaysAgo: 55 },
        { customerIdx: 7, status: 'PAID',    amount: 32000,  paidDaysAgo: 47 },
        { customerIdx: 2, status: 'OVERDUE', amount: 280000, daysOverdue: 38 },
        { customerIdx: 5, status: 'OVERDUE', amount: 160000, daysOverdue: 42 },
      ]},
      // ── May 2026 ──
      { year: 2026, month: 4, invoices: [
        { customerIdx: 1, status: 'PAID',    amount: 65000,  paidDaysAgo: 22 },
        { customerIdx: 4, status: 'PAID',    amount: 38000,  paidDaysAgo: 18 },
        { customerIdx: 6, status: 'PAID',    amount: 52000,  paidDaysAgo: 25 },
        { customerIdx: 0, status: 'OVERDUE', amount: 95000,  daysOverdue: 18 },
        { customerIdx: 3, status: 'PENDING', amount: 88000 },
      ]},
      // ── June 2026 — current month ──
      { year: 2026, month: 5, invoices: [
        // Current week payments → positive WoW trend
        { customerIdx: 1, status: 'PAID', amount: 68000,  paidDaysAgo: 2 },
        { customerIdx: 3, status: 'PAID', amount: 88000,  paidDaysAgo: 4 },
        // Last week payments
        { customerIdx: 0, status: 'PAID', amount: 75000,  paidDaysAgo: 9 },
        { customerIdx: 6, status: 'PAID', amount: 52000,  paidDaysAgo: 11 },
        // Active overdue / pending
        { customerIdx: 5, status: 'OVERDUE', amount: 320000, daysOverdue: 5 },
        { customerIdx: 2, status: 'PENDING', amount: 145000 },
      ]},
    ]

    let monthlyCount = 0
    for (const monthDef of MONTHLY_DATA) {
      const monthStart = new Date(monthDef.year, monthDef.month, 1)
      for (const inv of monthDef.invoices) {
        const cl = CLIENTS[inv.customerIdx]!
        const clientId = clientMap.get(cl.name)!
        const invoiceDay = rand(1, 25)
        const createdDate = new Date(monthDef.year, monthDef.month, invoiceDay)
        const dueDate = new Date(createdDate)
        dueDate.setDate(dueDate.getDate() + 30)

        const agingDays = inv.status === 'OVERDUE' ? (inv.daysOverdue ?? rand(5, 30)) : 0
        const paidAt = inv.status === 'PAID' && inv.paidDaysAgo !== undefined
          ? new Date(now.getTime() - inv.paidDaysAgo * 86400000)
          : null

        const invoiceRecord = await prisma.invoice.create({
          data: {
            companyId: company.id,
            clientId,
            customerName: cl.name,
            customerPhone: cl.phone,
            amount: new Decimal(inv.amount),
            currency: 'INR',
            dueDate,
            paidAt,
            status: inv.status,
            agingDays,
            invoiceDate: createdDate,
            invoiceNumber: `CHAU-${monthDef.year}-T${String(rand(1000, 9999))}`,
            description: `Professional services — ${cl.serviceScope[0]}`,
          },
        })
        monthlyCount++

        const updatedAtForSparkline = inv.status === 'OVERDUE'
          ? new Date(now.getTime() - agingDays * 86400000)
          : monthStart
        await prisma.$executeRaw`
          UPDATE invoices
          SET "createdAt" = ${createdDate}::timestamptz,
              "updatedAt" = ${updatedAtForSparkline}::timestamptz
          WHERE id = ${invoiceRecord.id}
        `
      }
    }
    console.log(`✓ ${monthlyCount} monthly trend invoices seeded (Jan–Jun 2026)`)
  }

  // ── 7. WhatsApp templates ────────────────────────────────────────────────────
  for (const tmpl of WA_TEMPLATES) {
    await prisma.whatsAppTemplate.upsert({
      where: { companyId_key: { companyId: company.id, key: tmpl.key } },
      update: { body: tmpl.body },
      create: { companyId: company.id, ...tmpl },
    })
  }
  console.log(`✓ ${WA_TEMPLATES.length} WhatsApp templates seeded`)

  // ── 8. WhatsApp messages ─────────────────────────────────────────────────────
  const waScenarios = [
    { clientName: 'Sunrise Hospitality Pvt Ltd', template: 'fee_reminder', status: MessageStatus.DELIVERED, hoursAgo: 48, body: 'Dear Meena Saxena,\n\nThis is a reminder that your professional fee of ₹3,20,000 for Apr 2026 is overdue by 112 days.\n\nKindly arrange the payment at your earliest convenience.\n\nRegards,\nChauhans Tax Consultants' },
    { clientName: 'Sunrise Hospitality Pvt Ltd', template: 'fee_reminder', status: MessageStatus.FAILED, hoursAgo: 24, body: 'Dear Meena Saxena,\n\nYour fee of ₹1,85,000 for Mar 2026 remains unpaid (74 days overdue). Please contact us urgently.\n\nChauhans Tax Consultants' },
    { clientName: 'Kapoor & Sons Construction', template: 'fee_reminder', status: MessageStatus.READ, hoursAgo: 72, body: 'Dear Deepak Kapoor,\n\nThis is a reminder that your professional fee of ₹4,20,000 for Feb 2026 is overdue by 93 days.\n\nKindly arrange the payment.\n\nRegards,\nChauhans Tax Consultants' },
    { clientName: 'Raj Exports Pvt Ltd', template: 'fee_reminder', status: MessageStatus.DELIVERED, hoursAgo: 36, body: 'Dear Arvind Raj,\n\nYour fee of ₹1,35,000 for Apr 2026 is overdue by 47 days. Please clear at earliest.\n\nChauhans Tax Consultants' },
    { clientName: 'Kapoor & Sons Construction', template: 'doc_request', status: MessageStatus.DELIVERED, hoursAgo: 120, body: 'Dear Deepak Kapoor,\n\nWe require your BANK_STATEMENT for May 2026 to proceed with your GST filing.\n\nKindly share by 5th June 2026.\n\nChauhans Tax Consultants' },
    { clientName: 'Raj Exports Pvt Ltd', template: 'deadline_nudge', status: MessageStatus.READ, hoursAgo: 18, body: 'Dear Arvind Raj,\n\nYour GST filing deadline is on 20 Jun 2026 (20 days away).\n\nWe still need: Bank statement for May 2026\n\nChauhans Tax Consultants' },
    { clientName: 'Sharma Retail Pvt Ltd', template: 'payment_received', status: MessageStatus.DELIVERED, hoursAgo: 6, body: 'Dear Sunita Sharma,\n\nWe acknowledge receipt of ₹72,000 against invoice #CHAU-2026-4521. Thank you for the timely payment.\n\nChauhans Tax Consultants' },
    { clientName: 'Verma IT Solutions', template: 'deadline_nudge', status: MessageStatus.SENT, hoursAgo: 4, body: 'Dear Rohit Verma,\n\nYour quarterly GST filing deadline is on 22 Jul 2026 (52 days away). Please keep documents ready.\n\nChauhans Tax Consultants' },
    // Inbound from client (doc received via WhatsApp)
    { clientName: 'Malhotra Fine Jewellers', template: 'INBOUND_MEDIA', status: MessageStatus.DELIVERED, hoursAgo: 8, body: 'Harish Malhotra sent a photo/document via WhatsApp — saved to Documents automatically.', direction: MessageDirection.INBOUND, numMedia: 1 },
    { clientName: 'Delhi Auto Components', template: 'doc_request', status: MessageStatus.READ, hoursAgo: 96, body: 'Dear Suresh Dhingra,\n\nWe require your INVOICE documents for May 2026. Please share by 3rd June.\n\nChauhans Tax Consultants' },
  ]

  for (const msg of waScenarios) {
    const clientId = clientMap.get(msg.clientName)
    const cl = CLIENTS.find((c) => c.name === msg.clientName)!
    await prisma.whatsAppMessage.create({
      data: {
        companyId: company.id,
        clientId: clientId ?? null,
        direction: (msg as any).direction ?? MessageDirection.OUTBOUND,
        toPhone: (msg as any).direction === MessageDirection.INBOUND ? null : cl.phone,
        fromPhone: (msg as any).direction === MessageDirection.INBOUND ? cl.phone : null,
        templateKey: msg.template,
        body: msg.body,
        status: msg.status,
        twilioSid: `SM${Math.random().toString(36).slice(2, 34)}`,
        sentAt: new Date(Date.now() - msg.hoursAgo * 3600000),
        deliveredAt: msg.status === MessageStatus.DELIVERED || msg.status === MessageStatus.READ ? new Date(Date.now() - (msg.hoursAgo - 1) * 3600000) : null,
        metadata: (msg as any).numMedia ? { numMedia: 1 } : Prisma.JsonNull,
      },
    })
  }
  console.log(`✓ ${waScenarios.length} WhatsApp messages seeded`)

  // ── 9. Documents ─────────────────────────────────────────────────────────────
  const docScenarios: Array<{
    clientName: string
    documentType: DocumentType
    status: DocumentStatus
    originalName: string
    filingPeriod?: string
    notes?: string
    extractedData?: object
    documentOwner: DocumentOwner
    documentPurpose: DocumentPurpose
    sourceChannel: SourceChannel
    syncStatus: SyncStatus
    createdDaysAgo: number
  }> = [
    {
      clientName: 'Raj Exports Pvt Ltd',
      documentType: DocumentType.INVOICE,
      status: DocumentStatus.VERIFIED,
      originalName: 'Raj_Exports_Invoice_Apr2026.pdf',
      filingPeriod: 'Apr 2026',
      documentOwner: DocumentOwner.FIRM,
      documentPurpose: DocumentPurpose.RECEIVABLE,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.SYNCED,
      extractedData: { invoiceNumber: 'CHAU-2026-4101', invoiceDate: '2026-04-15', clientName: 'Raj Exports Pvt Ltd', totalAmount: 135000, gstAmount: 20338, confidence: 0.95 },
      createdDaysAgo: 45,
    },
    {
      clientName: 'Raj Exports Pvt Ltd',
      documentType: DocumentType.GST_RETURN,
      status: DocumentStatus.NEEDS_REVIEW,
      originalName: 'GSTR1_Raj_Apr2026.pdf',
      filingPeriod: 'Apr 2026',
      notes: 'Turnover slightly lower than expected — verify with client before filing',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { gstNumber: '07AABCR1234A1Z5', filingPeriod: 'Apr 2026', totalTaxableValue: 850000, totalCGST: 76500, totalSGST: 76500, confidence: 0.73 },
      createdDaysAgo: 12,
    },
    {
      clientName: 'Kapoor & Sons Construction',
      documentType: DocumentType.INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'Kapoor_Invoice_Feb2026.pdf',
      filingPeriod: 'Feb 2026',
      documentOwner: DocumentOwner.FIRM,
      documentPurpose: DocumentPurpose.RECEIVABLE,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'CHAU-2026-3892', invoiceDate: '2026-02-10', clientName: 'Kapoor & Sons Construction', totalAmount: 420000, gstAmount: 63305, confidence: 0.91 },
      createdDaysAgo: 110,
    },
    {
      clientName: 'Kapoor & Sons Construction',
      documentType: DocumentType.BANK_STATEMENT,
      status: DocumentStatus.UPLOADED,
      originalName: 'KapoorSons_BankStmt_May2026.pdf',
      filingPeriod: 'May 2026',
      notes: 'Just received from client — pending OCR extraction',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.WHATSAPP_INBOUND,
      syncStatus: SyncStatus.NOT_APPLICABLE,
      createdDaysAgo: 1,
    },
    {
      clientName: 'Verma IT Solutions',
      documentType: DocumentType.TDS_CERTIFICATE,
      status: DocumentStatus.VERIFIED,
      originalName: 'Form16A_Verma_Q4FY26.pdf',
      filingPeriod: 'Jan–Mar 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.SYNCED,
      extractedData: { deductorName: 'Infosys BPM Ltd', tan: 'BLRI04679F', section: '194J', tdsAmount: 34500, filingPeriod: 'Jan-Mar 2026', confidence: 0.96 },
      createdDaysAgo: 55,
    },
    {
      clientName: 'Malhotra Fine Jewellers',
      documentType: DocumentType.GST_RETURN,
      status: DocumentStatus.PROCESSED,
      originalName: 'GSTR3B_Malhotra_Apr2026.pdf',
      filingPeriod: 'Apr 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.WHATSAPP_INBOUND,
      syncStatus: SyncStatus.PENDING,
      extractedData: { gstNumber: '07AADPM2345E1Z9', filingPeriod: 'Apr 2026', totalTaxableValue: 320000, totalCGST: 22400, totalSGST: 22400, taxPaid: 'Yes', confidence: 0.88 },
      createdDaysAgo: 8,
    },
    {
      clientName: 'Sharma Retail Pvt Ltd',
      documentType: DocumentType.INVOICE,
      status: DocumentStatus.VERIFIED,
      originalName: 'Sharma_Retail_Invoice_May2026.pdf',
      filingPeriod: 'May 2026',
      documentOwner: DocumentOwner.FIRM,
      documentPurpose: DocumentPurpose.RECEIVABLE,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.SYNCED,
      extractedData: { invoiceNumber: 'CHAU-2026-4521', invoiceDate: '2026-05-08', clientName: 'Sharma Retail Pvt Ltd', totalAmount: 72000, gstAmount: 10847, confidence: 0.97 },
      createdDaysAgo: 23,
    },
    {
      clientName: 'Delhi Auto Components',
      documentType: DocumentType.BANK_STATEMENT,
      status: DocumentStatus.FAILED,
      originalName: 'DelhiAuto_BankStmt_Apr2026.pdf',
      filingPeriod: 'Apr 2026',
      notes: 'OCR extraction failed — file appears scanned at low resolution. Request re-scan from client.',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.NOT_APPLICABLE,
      createdDaysAgo: 18,
    },
    {
      clientName: 'Sunrise Hospitality Pvt Ltd',
      documentType: DocumentType.INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'Sunrise_Invoice_Nov2025.pdf',
      filingPeriod: 'Nov 2025',
      documentOwner: DocumentOwner.FIRM,
      documentPurpose: DocumentPurpose.RECEIVABLE,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.FAILED,
      extractedData: { invoiceNumber: 'CHAU-2025-3201', invoiceDate: '2025-11-20', clientName: 'Sunrise Hospitality Pvt Ltd', totalAmount: 320000, gstAmount: 48203, confidence: 0.89 },
      createdDaysAgo: 192,
    },
    {
      clientName: 'Bharat Organic Farms',
      documentType: DocumentType.FORM_16,
      status: DocumentStatus.VERIFIED,
      originalName: 'Form16_Prakash_FY2526.pdf',
      filingPeriod: 'FY 2025-26',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.SYNCED,
      extractedData: { employeeName: 'Prakash Bhardwaj', pan: 'AABPB8901H', employer: 'Bharat Organic Farms', grossSalary: 840000, tdsDeducted: 25200, filingYear: 'AY 2026-27', confidence: 0.98 },
      createdDaysAgo: 10,
    },
    // ── Client-side invoices (for reconciliation demo) ──────────────────────────
    {
      clientName: 'Raj Exports Pvt Ltd',
      documentType: DocumentType.CLIENT_SALES_INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'raj_exports_sales_inv_may2026.pdf',
      filingPeriod: 'May 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'RE-INV-2026-0812', invoiceDate: '2026-05-14', sellerName: 'Raj Exports Pvt Ltd', sellerGstin: '07AABCR1234A1Z5', buyerName: 'Global Traders Ltd', buyerGstin: '27AABCG7777A1Z2', amount: 580000, gstAmount: 104400, totalAmount: 684400, igst: 104400, cgst: null, sgst: null, confidence: 0.94 },
      createdDaysAgo: 18,
    },
    {
      clientName: 'Sharma Retail Pvt Ltd',
      documentType: DocumentType.CLIENT_SALES_INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'sharma_retail_sales_inv_may2026.pdf',
      filingPeriod: 'May 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.WHATSAPP_INBOUND,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'SR-2026-1145', invoiceDate: '2026-05-22', sellerName: 'Sharma Retail Pvt Ltd', sellerGstin: '27AAHCS5678B1Z3', buyerName: 'Metro Supermart', buyerGstin: '27AABCM4444A1Z6', amount: 245000, gstAmount: 44100, totalAmount: 289100, igst: null, cgst: 22050, sgst: 22050, confidence: 0.91 },
      createdDaysAgo: 10,
    },
    {
      clientName: 'Kapoor & Sons Construction',
      documentType: DocumentType.CLIENT_PURCHASE_INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'kapoor_purchase_cement_may2026.pdf',
      filingPeriod: 'May 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'CEM-2026-4401', invoiceDate: '2026-05-05', vendorName: 'UltraTech Cement Ltd', vendorGstin: '08AABCU3456A1Z9', buyerName: 'Kapoor & Sons Construction', buyerGstin: '08AAECK3456C1Z7', amount: 320000, gstAmount: 57600, totalAmount: 377600, igst: null, cgst: 28800, sgst: 28800, confidence: 0.93 },
      createdDaysAgo: 25,
    },
    {
      clientName: 'Verma IT Solutions',
      documentType: DocumentType.CLIENT_PURCHASE_INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'verma_purchase_cloud_may2026.pdf',
      filingPeriod: 'May 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'AWS-IN-2026-7823', invoiceDate: '2026-05-31', vendorName: 'Amazon Web Services India', vendorGstin: '29AABCA4268A1ZE', buyerName: 'Verma IT Solutions', buyerGstin: '29AABPV7890D1Z1', amount: 185000, gstAmount: 33300, totalAmount: 218300, igst: 33300, cgst: null, sgst: null, confidence: 0.97 },
      createdDaysAgo: 3,
    },
    {
      clientName: 'Delhi Auto Components',
      documentType: DocumentType.CLIENT_PURCHASE_INVOICE,
      status: DocumentStatus.PROCESSED,
      originalName: 'delhi_auto_purchase_steel_apr2026.pdf',
      filingPeriod: 'Apr 2026',
      documentOwner: DocumentOwner.CLIENT,
      documentPurpose: DocumentPurpose.TAX_PREPARATION,
      sourceChannel: SourceChannel.MANUAL_UPLOAD,
      syncStatus: SyncStatus.PENDING,
      extractedData: { invoiceNumber: 'STL-2026-2209', invoiceDate: '2026-04-18', vendorName: 'SAIL Steel Distributors', vendorGstin: '07AABCS6789A1Z4', buyerName: 'Delhi Auto Components', buyerGstin: '07AABCD4567G1Z3', amount: 420000, gstAmount: 75600, totalAmount: 495600, igst: null, cgst: 37800, sgst: 37800, confidence: 0.90 },
      createdDaysAgo: 42,
    },
  ]

  const createdDocs: { id: string; documentType: DocumentType; extractedData: object | null }[] = []

  for (const doc of docScenarios) {
    const clientId = clientMap.get(doc.clientName)
    const created = await prisma.document.create({
      data: {
        companyId: company.id,
        uploadedById: userId,
        clientId: clientId ?? null,
        documentType: doc.documentType,
        status: doc.status,
        originalName: doc.originalName,
        storageKey: `${company.id}/2026/${String(rand(1, 12)).padStart(2, '0')}/seed-${Math.random().toString(36).slice(2, 10)}.pdf`,
        fileSizeBytes: rand(28000, 250000),
        mimeType: 'application/pdf',
        extractedData: doc.extractedData ?? Prisma.JsonNull,
        notes: doc.notes ?? null,
        filingPeriod: doc.filingPeriod ?? null,
        documentOwner: doc.documentOwner,
        documentPurpose: doc.documentPurpose,
        sourceChannel: doc.sourceChannel,
        syncStatus: doc.syncStatus,
        classificationSource: doc.status === DocumentStatus.VERIFIED ? 'OCR_CONFIRMED' : doc.status === DocumentStatus.PROCESSED ? 'OCR_CONFIRMED' : 'USER_EXPLICIT',
        createdAt: daysAgo(doc.createdDaysAgo),
        updatedAt: daysAgo(Math.max(0, doc.createdDaysAgo - rand(1, 5))),
      },
    })
    createdDocs.push({ id: created.id, documentType: created.documentType, extractedData: created.extractedData as object | null })
  }
  console.log(`✓ ${docScenarios.length} documents seeded`)

  // Create PurchaseInvoice records for CLIENT_PURCHASE_INVOICE documents
  const parseDecimal = (v: unknown) => {
    const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''))
    return isNaN(n) ? null : n
  }
  const parseIsoDate = (v: unknown) => {
    if (!v || typeof v !== 'string') return null
    const d = new Date(v); return isNaN(d.getTime()) ? null : d
  }
  let purchaseInvoiceCount = 0
  for (const doc of createdDocs) {
    if (doc.documentType !== DocumentType.CLIENT_PURCHASE_INVOICE) continue
    const raw = doc.extractedData as Record<string, unknown> | null
    await prisma.purchaseInvoice.create({
      data: {
        companyId: company.id,
        documentId: doc.id,
        vendorName: (raw?.['vendorName'] as string | undefined) ?? null,
        vendorGstin: (raw?.['vendorGstin'] as string | undefined) ?? null,
        invoiceNumber: (raw?.['invoiceNumber'] as string | undefined) ?? null,
        invoiceDate: parseIsoDate(raw?.['invoiceDate']),
        taxableAmount: parseDecimal(raw?.['amount']),
        igst: parseDecimal(raw?.['igst']),
        cgst: parseDecimal(raw?.['cgst']),
        sgst: parseDecimal(raw?.['sgst']),
        totalAmount: parseDecimal(raw?.['totalAmount']),
        filingPeriod: (raw?.['filingPeriod'] as string | undefined) ?? null,
      },
    })
    purchaseInvoiceCount++
  }
  if (purchaseInvoiceCount > 0) {
    console.log(`✓ ${purchaseInvoiceCount} purchase invoice records seeded`)
  }

  // ── 10. Filing Type Templates ────────────────────────────────────────────────
  const FILING_TEMPLATES = [
    { filingType: FilingType.GST_MONTHLY, label: 'GST Monthly Filing (GSTR-1 + GSTR-3B)', requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'], minDocCounts: { INVOICE: 1, BANK_STATEMENT: 1 } },
    { filingType: FilingType.GST_QUARTERLY, label: 'GST Quarterly Filing (QRMP Scheme)', requiredDocTypes: ['INVOICE', 'BANK_STATEMENT', 'GST_RETURN'], minDocCounts: { INVOICE: 1, BANK_STATEMENT: 1 } },
    { filingType: FilingType.TDS_QUARTERLY, label: 'TDS Quarterly Return (26Q/24Q)', requiredDocTypes: ['TDS_CERTIFICATE', 'BANK_STATEMENT'], minDocCounts: { TDS_CERTIFICATE: 1, BANK_STATEMENT: 1 } },
    { filingType: FilingType.ITR_ANNUAL, label: 'Income Tax Return (Annual)', requiredDocTypes: ['FORM_16', 'BANK_STATEMENT'], minDocCounts: { FORM_16: 1, BANK_STATEMENT: 1 } },
  ]
  for (const tmpl of FILING_TEMPLATES) {
    await prisma.filingTypeTemplate.upsert({
      where: { companyId_filingType: { companyId: company.id, filingType: tmpl.filingType } },
      update: {},
      create: { companyId: company.id, ...tmpl },
    })
  }
  console.log(`✓ ${FILING_TEMPLATES.length} filing type templates seeded`)

  // ── 11. Compliance Checklists ────────────────────────────────────────────────
  const checklistScenarios: Array<{
    clientName: string
    filingType: FilingType
    filingPeriod: string
    label: string
    dueDate: Date
    status: ChecklistStatus
    readinessScore: number
    requiredDocTypes: string[]
    missingItems: object[]
  }> = [
    {
      clientName: 'Raj Exports Pvt Ltd',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'May 2026',
      label: 'GST Monthly Filing — Raj Exports — May 2026',
      dueDate: new Date('2026-06-20'),
      status: ChecklistStatus.IN_PROGRESS,
      readinessScore: 50,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [{ documentType: 'BANK_STATEMENT', label: 'Bank Statement', required: 1, received: 0 }],
    },
    {
      clientName: 'Raj Exports Pvt Ltd',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'Apr 2026',
      label: 'GST Monthly Filing — Raj Exports — Apr 2026',
      dueDate: new Date('2026-05-20'),
      status: ChecklistStatus.FILED,
      readinessScore: 100,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [],
    },
    {
      clientName: 'Sharma Retail Pvt Ltd',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'May 2026',
      label: 'GST Monthly Filing — Sharma Retail — May 2026',
      dueDate: new Date('2026-06-20'),
      status: ChecklistStatus.READY,
      readinessScore: 100,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [],
    },
    {
      clientName: 'Kapoor & Sons Construction',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'May 2026',
      label: 'GST Monthly Filing — Kapoor & Sons — May 2026',
      dueDate: new Date('2026-06-20'),
      status: ChecklistStatus.IN_PROGRESS,
      readinessScore: 30,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [
        { documentType: 'INVOICE', label: 'Sales Invoices', required: 1, received: 0 },
        { documentType: 'BANK_STATEMENT', label: 'Bank Statement', required: 1, received: 1 },
      ],
    },
    {
      clientName: 'Kapoor & Sons Construction',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'Apr 2026',
      label: 'GST Monthly Filing — Kapoor & Sons — Apr 2026',
      dueDate: new Date('2026-05-20'),
      status: ChecklistStatus.OVERDUE,
      readinessScore: 60,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [{ documentType: 'INVOICE', label: 'Sales Invoices', required: 1, received: 0 }],
    },
    {
      clientName: 'Verma IT Solutions',
      filingType: FilingType.GST_QUARTERLY,
      filingPeriod: 'Jan–Mar 2026',
      label: 'GST Quarterly — Verma IT — Jan–Mar 2026',
      dueDate: new Date('2026-04-22'),
      status: ChecklistStatus.FILED,
      readinessScore: 100,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT', 'GST_RETURN'],
      missingItems: [],
    },
    {
      clientName: 'Sunrise Hospitality Pvt Ltd',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'Apr 2026',
      label: 'GST Monthly Filing — Sunrise — Apr 2026',
      dueDate: new Date('2026-05-20'),
      status: ChecklistStatus.OVERDUE,
      readinessScore: 0,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT'],
      missingItems: [
        { documentType: 'INVOICE', label: 'Sales Invoices', required: 1, received: 0 },
        { documentType: 'BANK_STATEMENT', label: 'Bank Statement', required: 1, received: 0 },
      ],
    },
    {
      clientName: 'Delhi Auto Components',
      filingType: FilingType.TDS_QUARTERLY,
      filingPeriod: 'Jan–Mar 2026',
      label: 'TDS Return — Delhi Auto — Q4 FY2025-26',
      dueDate: new Date('2026-05-31'),
      status: ChecklistStatus.IN_PROGRESS,
      readinessScore: 40,
      requiredDocTypes: ['TDS_CERTIFICATE', 'BANK_STATEMENT'],
      missingItems: [{ documentType: 'TDS_CERTIFICATE', label: 'TDS Certificates', required: 1, received: 0 }],
    },
    {
      clientName: 'Bharat Organic Farms',
      filingType: FilingType.ITR_ANNUAL,
      filingPeriod: 'FY 2025-26',
      label: 'ITR Filing — Bharat Organic — AY 2026-27',
      dueDate: new Date('2026-07-31'),
      status: ChecklistStatus.READY,
      readinessScore: 100,
      requiredDocTypes: ['FORM_16', 'BANK_STATEMENT'],
      missingItems: [],
    },
    // Relative-date entries so "Compliance at Risk" always shows data
    {
      clientName: 'Verma IT Solutions',
      filingType: FilingType.GST_MONTHLY,
      filingPeriod: 'Current Month',
      label: 'GST Monthly Filing — Verma IT — Current Month',
      dueDate: daysFrom(5),
      status: ChecklistStatus.IN_PROGRESS,
      readinessScore: 20,
      requiredDocTypes: ['INVOICE', 'BANK_STATEMENT', 'GST_RETURN'],
      missingItems: [
        { documentType: 'INVOICE', label: 'Sales Invoices', required: 1, received: 0 },
        { documentType: 'GST_RETURN', label: 'GST Return Draft', required: 1, received: 0 },
      ],
    },
    {
      clientName: 'Sunrise Hospitality Pvt Ltd',
      filingType: FilingType.TDS_QUARTERLY,
      filingPeriod: 'Current Quarter',
      label: 'TDS Return — Sunrise — Current Quarter',
      dueDate: daysFrom(10),
      status: ChecklistStatus.IN_PROGRESS,
      readinessScore: 0,
      requiredDocTypes: ['TDS_CERTIFICATE', 'BANK_STATEMENT'],
      missingItems: [
        { documentType: 'TDS_CERTIFICATE', label: 'TDS Certificates', required: 1, received: 0 },
        { documentType: 'BANK_STATEMENT', label: 'Bank Statement', required: 1, received: 0 },
      ],
    },
  ]

  for (const cl of checklistScenarios) {
    const clientId = clientMap.get(cl.clientName)!
    await prisma.complianceChecklist.upsert({
      where: {
        companyId_clientId_filingType_filingPeriod: {
          companyId: company.id,
          clientId,
          filingType: cl.filingType,
          filingPeriod: cl.filingPeriod,
        },
      },
      update: {},
      create: {
        companyId: company.id,
        clientId,
        filingType: cl.filingType,
        filingPeriod: cl.filingPeriod,
        label: cl.label,
        dueDate: cl.dueDate,
        status: cl.status,
        readinessScore: cl.readinessScore,
        requiredDocTypes: cl.requiredDocTypes,
        missingItems: cl.missingItems,
        assignedUserId: cl.status !== ChecklistStatus.FILED ? staffId : null,
        completedAt: cl.status === ChecklistStatus.FILED ? daysAgo(rand(5, 20)) : null,
      },
    })
  }
  console.log(`✓ ${checklistScenarios.length} compliance checklists seeded`)

  // ── 12. AI Insights ──────────────────────────────────────────────────────────
  for (const ins of INSIGHTS) {
    await prisma.aIInsight.create({
      data: {
        companyId: company.id,
        module: AIModule.DASHBOARD,
        category: ins.category,
        severity: ins.severity,
        summary: ins.summary,
        dataSnapshot: { seededAt: new Date().toISOString() },
      },
    })
  }
  console.log(`✓ ${INSIGHTS.length} AI insights seeded`)

  // ── 13. Reports ──────────────────────────────────────────────────────────────
  const periodEnd = new Date()
  const periodStart = daysAgo(30)

  await prisma.report.create({
    data: {
      companyId: company.id,
      generatedById: userId,
      reportType: ReportType.RECEIVABLES_SUMMARY,
      status: ReportStatus.COMPLETED,
      periodStart,
      periodEnd,
      aiSummary: `Total receivables of ₹18.4L recorded in the 30-day period. Sunrise Hospitality (₹11.5L) and Kapoor & Sons (₹4.7L) account for 88% of the overdue balance. Recommend issuing formal demand notices to both — Sunrise Hospitality has 3 invoices unpaid for 45–112 days. 4 new payments received (₹3.1L) — Sharma Retail and Delhi Auto paid on time. Collections efficiency at 67% vs 72% last month; priority action: Kapoor & Sons in-person visit scheduled for this week.`,
      dataSnapshot: {
        totalAmount: 1840000,
        totalInvoices: 32,
        avgAgingDays: 38,
        byStatus: [
          { status: 'PENDING', count: 8, amount: 680000 },
          { status: 'OVERDUE', count: 12, amount: 1160000 },
          { status: 'PAID', count: 8, amount: 430000 },
          { status: 'PARTIAL', count: 4, amount: 420000 },
        ],
        topDebtors: [
          { name: 'Sunrise Hospitality Pvt Ltd', amount: 1150000, agingDays: 112 },
          { name: 'Kapoor & Sons Construction', amount: 470000, agingDays: 93 },
          { name: 'Raj Exports Pvt Ltd', amount: 135000, agingDays: 47 },
        ],
      },
    },
  })

  await prisma.report.create({
    data: {
      companyId: company.id,
      generatedById: userId,
      reportType: ReportType.COLLECTIONS_AGING,
      status: ReportStatus.COMPLETED,
      periodStart: daysAgo(90),
      periodEnd: daysAgo(1),
      aiSummary: `Aging analysis for 90-day period. 37% of outstanding balance is 60+ days overdue — above industry average of 22% for CA firms. Sunrise Hospitality is the primary outlier with 112 days aging. Recommend quarterly credit review policy for clients with >₹2L outstanding.`,
      dataSnapshot: {
        agingBuckets: [
          { bucket: '0-30 days', count: 8, amount: 680000 },
          { bucket: '31-60 days', count: 6, amount: 340000 },
          { bucket: '61-90 days', count: 5, amount: 650000 },
          { bucket: '90+ days', count: 4, amount: 820000 },
        ],
      },
    },
  })

  await prisma.report.create({
    data: {
      companyId: company.id,
      generatedById: userId,
      reportType: ReportType.AI_INSIGHTS_DIGEST,
      status: ReportStatus.PENDING,
      periodStart,
      periodEnd,
    },
  })
  console.log('✓ 3 reports seeded')

  // ── 14. Knowledge documents + chunks ────────────────────────────────────────
  for (const kd of KNOWLEDGE_DOCS) {
    const existing = await prisma.knowledgeDocument.findFirst({
      where: { companyId: company.id, title: kd.title },
    })
    if (existing) {
      console.log(`  (skipping knowledge doc "${kd.title}" — already exists)`)
      continue
    }

    const doc = await prisma.knowledgeDocument.create({
      data: { companyId: company.id, title: kd.title, category: kd.category, content: kd.content },
    })

    const chunkSize = 800
    const overlap = 100
    const chunks: string[] = []
    let i = 0
    while (i < kd.content.length) {
      chunks.push(kd.content.slice(i, i + chunkSize).trim())
      i += chunkSize - overlap
    }
    for (let ci = 0; ci < chunks.length; ci++) {
      const zeroVec = '[' + Array(1536).fill('0').join(',') + ']'
      await prisma.$executeRaw`
        INSERT INTO "knowledge_chunks" ("id", "documentId", "companyId", "chunkIndex", "content", "embedding", "createdAt")
        VALUES (gen_random_uuid()::text, ${doc.id}, ${company.id}, ${ci}, ${chunks[ci]!}, ${zeroVec}::vector, NOW())
      `
    }
  }
  console.log(`✓ ${KNOWLEDGE_DOCS.length} knowledge documents seeded`)

  // ── 15. Update admin user moduleAccess ───────────────────────────────────────
  await prisma.user.update({
    where: { id: userId },
    data: {
      moduleAccess: ['dashboard', 'collections', 'documents', 'reports', 'whatsapp', 'assistant', 'compliance', 'settings'],
    },
  })
  console.log('✓ Admin moduleAccess updated (all modules)')

  console.log('\n✅ Chauhans seed complete!')
  console.log('   Reload the app and log in as the Chauhans admin to see the data.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
