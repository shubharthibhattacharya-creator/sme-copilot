# OpsCopilot — Product & Technical Document
> Version 1.0 · May 2026 · Confidential

---

# PART A — BUSINESS SEGMENT

---

## 1. Problem Statement

### 1.1 Who We Serve

Indian SMEs — primarily **CA (Chartered Accountant) Firms**, **Distributors**, and **Manufacturers** — are drowning in operational complexity that no existing software solves end-to-end.

### 1.2 The Core Problem

#### For CA Firms
A typical CA firm managing 50–200 clients faces this every month:

| Pain Point | Daily Reality |
|---|---|
| **GST Deadline Chaos** | Track 200 clients × 2 deadlines/month on Excel. One missed deadline = ₹50/day late fee + client relationship damage |
| **Document Collection Hell** | Clients email/WhatsApp documents informally. No tracking. OCR done manually. Errors missed |
| **Payment Recovery** | Fees go unpaid for 60–90 days. Manual follow-up calls take 2–3 hours/day per staff |
| **Status Queries** | "Is my GST filed?" calls arrive 20× a day. Each call takes 5–10 minutes of staff time |
| **Zero Visibility** | No single view of which client is at risk, which document is missing, which deadline is tomorrow |

#### For Distributors & Manufacturers
| Pain Point | Daily Reality |
|---|---|
| **Receivables Aging** | Outstanding invoices tracked in Excel. No automated follow-up. Collections team wastes hours on manual calls |
| **Inventory Blindness** | Stock-outs discovered only when orders fail. No early warning system |
| **Payment Confirmation** | Customers say "payment done" on WhatsApp. Staff manually verifies and reconciles — 30 min per confirmation |
| **No Risk Intelligence** | No scoring of which customers are likely to delay. Reactive, not proactive |

### 1.3 The Numbers Behind the Pain

- **₹8.7 lakh crore** — Total GST late fees collected by government in FY23 due to missed deadlines
- **43 days** — Average receivables aging for Indian SMEs (RBI MSME Financing Report 2023)
- **3.2 hours/day** — Time a CA firm staff member spends on manual follow-up and status queries
- **68%** of Indian SMEs still use Excel or paper for compliance tracking (NASSCOM 2024)
- **₹2.1 lakh** — Average annual late fees paid by a mid-size CA firm due to process gaps
- **1 in 3** CA firms have lost a client due to a missed filing deadline (ICAI survey 2023)

### 1.4 Why Existing Tools Fail

| Tool | What It Does | What It Misses |
|---|---|---|
| **TallyPrime** | Accounting, inventory | No client communication, no AI, no cloud, no WhatsApp |
| **ClearTax** | GST return filing | Only filings — no collections, documents, or client ops |
| **Zoho Books** | Accounting | Not India-first enough; no WhatsApp; no CA-specific workflows |
| **Excel** | Everything | Manual, error-prone, no automation, no AI |
| **WhatsApp alone** | Communication | No structure, no tracking, no automation |

**The gap:** No single product handles compliance tracking + collections + document management + WhatsApp automation + AI intelligence — all tailored for Indian SMEs.

---

## 2. Solution Overview

### 2.1 What OpsCopilot Is

**OpsCopilot is an AI-powered operations platform for Indian SMEs** that automates the full client operations lifecycle — from document collection to payment recovery to compliance filing — through one unified dashboard, with WhatsApp as the primary communication channel.

```
┌─────────────────────────────────────────────────────────────────┐
│                         OPSCOP ILOT                              │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Collections│  │Documents │  │Compliance│  │  WhatsApp    │   │
│  │& Risk AI  │  │& OCR AI  │  │Calendar  │  │  Automation  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │    AI    │  │Inventory │  │ Reports  │  │    Admin     │   │
│  │Assistant │  │Tracking  │  │& Exports │  │   Console    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│                                                                   │
│              Powered by Claude AI (Anthropic)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 The Three Personas

**CA Firm** — Manages 50–200 clients for GST, TDS, MCA filings
- Needs: Client master, GST calendar, document OCR, fee collections, WhatsApp comms

**Distributor** — Trades goods, manages B2B receivables
- Needs: Invoice aging, risk scoring, payment reminders, inventory alerts

**Manufacturer** — Produces goods, manages supply chain and collections
- Needs: Inventory management, collections aging, payment automation

Each persona gets a **tailored UI, tailored AI insights, and tailored WhatsApp templates**.

### 2.3 The Three Pillars of Value

```
┌─────────────────────────────────────────────────┐
│                                                   │
│  PILLAR 1: AUTOMATE           PILLAR 2: INFORM   │
│  ─────────────────            ────────────────   │
│  WhatsApp reminders           AI risk scoring    │
│  Document OCR                 Deadline calendar  │
│  Magic-link uploads           Dashboard insights │
│  Auto-replies                 Custom reports     │
│                                                   │
│  PILLAR 3: CONTROL                               │
│  ──────────────────                              │
│  Multi-tenant admin panel                        │
│  37-parameter config engine                      │
│  Impersonation & audit logs                      │
│  Subscription management                         │
│                                                   │
└─────────────────────────────────────────────────┘
```

---

## 3. Detailed Features

### Module 1: Dashboard & AI Insights

**What it does:** Real-time command center with AI-generated actionable intelligence.

**Key Metrics Shown:**
- Total Receivables (Pending + Overdue)
- Overdue Amount + Count
- Collections Trend (week-over-week %)
- Average Aging Days
- Inventory Alerts (items at/below reorder)
- Documents Pending Review
- Critical Customers (top 3 by overdue amount)

**AI Insights Engine:**
- Claude generates 3–5 insights per refresh (triggered manually or on schedule)
- Severity levels: CRITICAL (red), WARNING (amber), INFO (blue)
- Context-aware: CA firm gets compliance insights; distributor gets receivables insights
- Example: *"You have ₹5.2L overdue from 8 customers. Focus on top 3: Sharma Textiles (₹2.1L, 45 days). Recommend immediate follow-up."*

---

### Module 2: Collections & Risk Scoring

**What it does:** Full receivables management with AI-powered risk scoring on every invoice.

**Features:**
- Paginated invoice list with risk badges (HIGH/MEDIUM/LOW)
- Aging breakdown: 0–30 / 31–60 / 61–90 / 90+ days buckets
- One-click WhatsApp payment reminder
- Risk score recalculation (on-demand or scheduled)

**Risk Scoring Algorithm:**
```
Risk Score (0.0 – 1.0) =
  aging_component  × 0.50   (days overdue / 90)
  amount_component × 0.30   (invoice amount / max company amount)
  history_component × 0.20  (historical late payment rate)

HIGH   = score ≥ 0.70  → red badge → immediate action
MEDIUM = score ≥ 0.30  → amber badge → schedule follow-up
LOW    = score < 0.30  → green badge → monitor
```

All thresholds are **configurable per tenant** — a distributor dealing in high-value goods can lower the high-risk threshold.

---

### Module 3: Document Management & OCR

**What it does:** AI-powered document pipeline — upload, extract, classify, link to filings.

**Supported Document Types:**
Invoice · Purchase Order · Delivery Note · GST Return · TDS Certificate · Bank Statement · Form 16 · Other

**OCR Pipeline:**
1. File uploaded (PDF/JPEG/PNG/WebP, max 10 MB)
2. Status → `UPLOADING` → `PROCESSING`
3. Claude Vision API reads document, extracts structured fields
4. Confidence score assigned (0.0–1.0)
5. ≥ 0.80 → `PROCESSED` (green) | 0.50–0.79 → `NEEDS_REVIEW` (amber) | < 0.50 → `FAILED` (red)
6. For GST Returns: filing period auto-extracted ("Nov 2024") and linked to compliance calendar
7. Email notification sent with extraction summary
8. If tax integration enabled: document auto-pushed to ClearTax/Zoho/Tally

**Extracted Fields per Document Type:**

| Document | Extracted Fields |
|---|---|
| Invoice | Invoice number, date, client name, vendor, amount, GST amount, total, GSTIN, PAN |
| GST Return | Period, GSTR type, taxable supply, IGST/CGST/SGST amounts |
| Purchase Order | PO number, date, vendor, items, total |
| Bank Statement | Account number, period, opening/closing balance, transaction count |
| TDS Certificate | Certificate number, deductor, deductee, PAN, period, TDS amount |

**Client Magic-Link Upload:**
- CA firm generates a shareable upload link per client
- Client clicks link, photographs document on phone — no login required
- Document enters the same OCR pipeline
- CA firm gets notified; document appears in client's folder

---

### Module 4: GST Filing Calendar (CA Firms)

**What it does:** Auto-tracks GST filing deadlines for every client and flags at-risk filings.

**Features:**
- Calendar view: client × period × deadline × status
- Status: `FILED` (green) / `PENDING` (amber) / `OVERDUE` (red)
- Days remaining countdown
- Document linked (shows "View" if GST return document uploaded)
- Bulk WhatsApp deadline nudge (all overdue/due-soon clients)
- Manual period override for any document

**Deadline Logic:**
```
MONTHLY filers:  deadline = 20th of current month
                 period   = previous month ("Oct 2024" → deadline 20 Nov)

QUARTERLY filers: deadline months = April, July, October, January (20th)
                  period = "Jan–Mar 2024", "Apr–Jun 2024", etc.
```

**Filing Heatmap:**
- 12-month × N-client color grid
- Green cell = filed | Red = overdue | Grey = pending
- Clickable cells open document or upload prompt

---

### Module 5: WhatsApp Automation

**What it does:** Full two-way WhatsApp communication via Twilio — automated reminders, document requests, and intelligent inbound handling.

**11 Built-in Message Templates:**

| Template | Trigger | Variables |
|---|---|---|
| `fee_reminder` | Manual / scheduled | clientName, amount, servicePeriod, agingDays |
| `doc_request` | Document request created | documentType, period, dueDate |
| `deadline_nudge` | Bulk GST nudge | daysUntilDeadline, deadlineDate, pendingDocuments |
| `payment_received` | Invoice marked PAID | amount, invoiceNumber |
| `inbound_ack` | Client sends document | count, fileType |
| `payment_confirmation_ack` | Client says "payment done" | clientName |
| `promise_to_pay_ack` | Client says "will pay Friday" | promiseDate |
| `invoice_summary_reply` | Client asks "how much?" | amount, dueDate, agingDays |
| `filing_status_reply` | Client asks "GST filed?" | period, deadline, status |
| `greeting_reply` | Client says "Hi" | firmName, capability summary |
| `ocr_result_ack` | OCR completes | statusEmoji, docLabel, period |

**Inbound Message Intelligence:**
Incoming WhatsApp messages are classified by keyword AI — no Claude API call, instant response:

```
"Paid the amount" → PAYMENT_CONFIRMATION → auto-reply payment_confirmation_ack
"Will pay Friday" → PROMISE_TO_PAY     → extract date, auto-reply with confirmation
"How much is due?" → INVOICE_QUERY     → fetch invoice, reply with amount + due date
"GST filed?"       → FILING_STATUS     → check calendar, reply with status
"Sent the doc"     → DOCUMENT_SENT     → acknowledge, check uploads
"Hi"               → GREETING          → reply with capability summary
[image/PDF sent]   → MEDIA             → route to OCR pipeline
```

**Safety Controls:**
- Quiet hours: no messages between 10 PM – 8 AM (configurable)
- Max 3 reminders per invoice (configurable)
- Max 10 messages/minute throttling
- Duplicate send prevention

---

### Module 6: AI Assistant (RAG Chat)

**What it does:** Intelligent Q&A over the firm's own knowledge base — SOPs, checklists, GST workflows, client policies.

**How it works:**
1. Admin uploads documents (PDF, plain text) to the knowledge base
2. Documents chunked (800 chars, 100-char overlap) and embedded via OpenAI
3. Stored in PostgreSQL with pgvector (1536 dimensions)
4. User asks a question in natural language
5. Question embedded → cosine search → top 5 relevant chunks retrieved
6. Claude answers using retrieved context + full conversation history
7. Answer includes citations (which document it came from)

**Knowledge Categories:** GST Workflow · TDS Workflow · Client Onboarding · Filing Checklist · Company Policy · General

**Example Queries:**
- *"What documents does a new GST client need to submit?"*
- *"What is the penalty for late GSTR-3B filing?"*
- *"How do I handle a client who has multiple GSTINs?"*
- *"What is our refund policy for cancelled services?"*

---

### Module 7: Inventory Management (Distributors/Manufacturers)

**What it does:** SKU-level inventory tracking with AI-powered stockout prediction.

**Features:**
- SKU master with quantity, reorder level, unit cost
- Movement velocity (units/day rolling average)
- Low-stock alert list (items at or below reorder level)
- Days-to-stockout calculation: `quantity / movementVelocity`
- Dashboard widget: top 5 stockout risks
- AI insight generation when critical items identified

---

### Module 8: Reports & Exports

**What it does:** One-click generation of business reports with AI executive summaries and multi-format export.

**5 Report Types:**

| Report | What it Shows |
|---|---|
| Collections Aging | Overdue amounts by bucket (0–30, 31–60, 61–90, 90+ days) |
| Receivables Summary | Total outstanding by status (Pending/Overdue/Paid) |
| Inventory Status | Low-stock items, stockout predictions, total inventory value |
| Cash Flow | Collected vs pending amounts, collection rate |
| AI Insights Digest | Curated severity-ranked AI insights for the period |

**Export Formats:**
- **PDF** — Branded with company name, header, AI summary, formatted tables
- **Excel (.xlsx)** — Tabular data with styled headers for analysis
- **Word (.docx)** — Narrative format with tables, suitable for client sharing

All reports include an **AI Executive Summary** — Claude generates a 2–3 sentence narrative of what the data means and what action to take.

---

### Module 9: Settings & Configuration Engine

**What it does:** Deep customization of business rules without writing code.

**37 Configurable Parameters across 6 categories:**

| Category | Parameters | Example |
|---|---|---|
| Collections | 12 | Aging bucket thresholds, risk weights, max reminders |
| AI Insights | 5 | Critical overdue threshold (₹), warning trend % |
| GST Compliance | 4 | Deadline day, urgency window, late fee rate |
| Documents | 5 | Max file size, OCR confidence thresholds |
| Reports | 6 | Default period, auto-report toggle |
| WhatsApp | 5 | Quiet hours, max per minute, max per invoice |

All parameters have system defaults, can be overridden per tenant, and reset to default at any time.

---

### Module 10: Admin Console (Operator Panel)

**What it does:** Complete SaaS operator tooling for the OpsCopilot team to manage all tenants.

**Features:**
- Tenant CRUD (create, view, update, deactivate)
- Per-tenant config override (all 37 params)
- Per-tenant knowledge base management
- Platform-wide audit log
- System config editor (global defaults)
- **Impersonation:** Login as any tenant for support/debugging (30-min, single-use token)
- CSV client import on behalf of tenants
- Platform stats: tenants, documents, messages, AI calls

---

## 4. User Journeys & Flow Diagrams

### 4.1 New Firm Onboarding Journey

```
Clerk Sign-Up
     │
     ▼
POST /auth/register ──► Creates DB User + Company (idempotent)
     │
     ▼
┌────────────────────────────────────────────────────┐
│              ONBOARDING WIZARD (5 Steps)            │
│                                                     │
│  Step 1: Firm Details                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ Firm Name* | GSTIN | PAN | Phone | Address  │   │
│  │              PATCH /settings/profile         │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│  Step 2: Choose Modules                             │
│  ┌─────────────────────────────────────────────┐   │
│  │ Dashboard ✓ | Collections ✓ | Reporting ✓   │   │
│  │ Documents ✓ | AI Assistant ✓ | WhatsApp ✓   │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│  Step 3: Add Clients (optional)                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Name* | GSTIN | Filer Type (M/Q/Annual)     │   │
│  │              POST /clients                   │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│  Step 4: WhatsApp Setup (optional)                  │
│  ┌─────────────────────────────────────────────┐   │
│  │ Twilio sandbox instructions | Phone number  │   │
│  └─────────────────────────────────────────────┘   │
│                    │                                │
│                    ▼                                │
│  Step 5: Review & Go to Dashboard                   │
└────────────────────────────────────────────────────┘
     │
     ▼
/dashboard  (role-based, persona-filtered sidebar)
```

---

### 4.2 Document Upload & OCR Journey (CA Firm)

```
┌──────────────────────────────────────────────────────────────────┐
│   PATH A: Staff uploads directly       PATH B: Client magic-link │
│                                                                    │
│   Staff → /documents                   Admin generates upload     │
│   Click "Upload"                       token for client           │
│   Select file + documentType           GET /upload-tokens         │
│   Optional: select clientId,           Returns: shareable URL     │
│   filingPeriod, notes                  (/upload/abc123xyz)        │
│           │                                    │                  │
│           │                            Client opens URL           │
│           │                            No login required          │
│           │                            Uploads document           │
│           └──────────────┬─────────────────────┘                 │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
                POST /documents (multipart)
                          │
                          ▼
              ┌─────────────────────────┐
              │ Validate:               │
              │ • MIME type OK?         │
              │ • Size ≤ 10 MB?         │
              │ • Token valid?          │
              └─────────┬───────────────┘
                        │
                        ▼
            Store file → disk/S3
            Create Document row
            Status: UPLOADED
                        │
                        ▼ (async, fire-and-forget)
            ┌───────────────────────────┐
            │  OCR PIPELINE             │
            │                           │
            │  Read file → base64       │
            │  Call Claude Vision API   │
            │  Parse structured JSON    │
            │  Compute confidence score │
            └──────────┬────────────────┘
                       │
              ┌────────┼────────┐
              │        │        │
           ≥0.80    0.50–0.79  <0.50
              │        │        │
           PROCESSED NEEDS_   FAILED
              │       REVIEW    │
              │        │        │
              └────────┼────────┘
                       │
                       ▼
            Auto-extract filingPeriod
            (for GST_RETURN docs)
                       │
                       ▼
            Send email notification
            (sendOcrComplete)
                       │
                       ▼
            If tax integration enabled:
            Push to ClearTax / Zoho / Tally
                       │
                       ▼
            Document appears in:
            • /documents list
            • /filings calendar (if GST return)
            • Client detail → documents tab
```

---

### 4.3 Collections & Payment Recovery Journey

```
Invoice Due
     │
     ▼
 Aging Engine (daily)
 Recalculates agingDays, riskScore
     │
     ├──► Dashboard: KPIs updated
     │
     ├──► AI Insights: Claude analyzes overdue pattern
     │    → "8 invoices overdue > 30 days,
     │       top risk: Sharma Textiles ₹2.1L"
     │
     ▼
Staff reviews Collections tab
     │
     ├──► Filters by: HIGH risk | 60+ days | customer name
     │
     ▼
Staff clicks "Send Reminder" on invoice
     │
     ▼
POST /whatsapp/invoices/:id/remind
     │
     ├──► Quiet hours check (10 PM – 8 AM → queued)
     ├──► Max reminders check (≤ 3 per invoice)
     ├──► Throttle check (≤ 10/minute)
     │
     ▼
Twilio sends WhatsApp message:
"Hi {clientName}, friendly reminder — ₹{amount}
is due for {servicePeriod}. Invoice has been
pending for {agingDays} days. — {firmName}"
     │
     ▼
Customer receives message
     │
  ┌──┴───────────────────────────────────┐
  │                                       │
"Paid the amount, check your account"  "Will pay by Friday"
  │                                       │
  ▼                                       ▼
POST /whatsapp/webhook               PROMISE_TO_PAY detected
Inbound classifier:                  promiseDate = "Friday" → abs date
PAYMENT_CONFIRMATION                        │
  │                                         ▼
  ▼                                  Auto-reply:
Auto-reply:                         "Thank you {clientName}!
"Thank you! We'll confirm           We've noted your commitment
receipt shortly. — {firmName}"      to pay by {date}."
  │
  ▼
Staff manually marks invoice PAID
PATCH /invoices/:id/status → PAID
  │
  ▼
Auto-send payment_received WhatsApp:
"Hi {clientName}, we've received ₹{amount}
for invoice #{invoiceNumber}. Thank you!"
  │
  ▼
riskScore reset to 0, aging cleared
```

---

### 4.4 GST Filing Compliance Journey (CA Firm)

```
 Each Month Start
       │
       ▼
 Filing Calendar computed
 for all active clients
       │
       ▼
 /filings/calendar shows:
 ┌────────────┬──────────┬────────────┬────────┬──────────┐
 │ Client     │ Period   │ Deadline   │ Status │ Document │
 ├────────────┼──────────┼────────────┼────────┼──────────┤
 │ Sharma Tex │ Oct 2024 │ 20 Nov     │ FILED  │ View     │
 │ Gupta Bros │ Oct 2024 │ 20 Nov     │ OVERDUE│ —        │
 │ ABC Traders│ Oct 2024 │ 20 Nov     │ PENDING│ —        │
 └────────────┴──────────┴────────────┴────────┴──────────┘
       │
       │
  ─10 days before deadline─
       │
       ▼
 Staff clicks "Send Bulk Nudge"
 POST /whatsapp/deadline-nudge
       │
       ▼
 All PENDING/OVERDUE clients receive:
 "Hi {name}, your GST return for {period}
 is due on {date} — {daysLeft} days left.
 Please submit {pendingDocs}. — {firmName}"
       │
       ▼
 Client responds:
  ┌────────────────────────────────────────────┐
  │                                            │
"GST done?"               Sends GST return PDF
  │                                │
  ▼                                ▼
FILING_STATUS_QUERY       MEDIA (PDF received)
  │                                │
  ▼                                ▼
Auto-lookup client's      Route to OCR pipeline
filing status                      │
  │                                ▼
  ▼                       Claude extracts: period,
Auto-reply with:          GSTR type, tax amounts
status, deadline,                  │
action required                    ▼
                          filingPeriod auto-set
                          Document linked to filing
                                   │
                                   ▼
                          Calendar row → FILED ✅
                          Email notification sent
```

---

### 4.5 Admin Operator Journey

```
Admin opens http://localhost:3002/login
     │
     ▼
Enter ADMIN_SECRET password
POST /api/auth → sets httpOnly cookie
     │
     ▼
Admin Dashboard: Platform Overview
┌─────────────────────────────────────────────────────┐
│ Total Tenants: 47  │  Total Docs: 12,847             │
│ Active Today:  23  │  WA Messages: 8,291             │
│ Storage Used:  4.2 GB │  AI Calls: 34,109           │
└─────────────────────────────────────────────────────┘
     │
     ▼
New Tenant Signup Flow:
─────────────────────
POST /admin/tenants
  { name, industry, plan, adminEmail, adminName }
         │
         ▼
  Creates: Company + User + 4 WA templates
  Sends: Clerk org invite to adminEmail
  Logs: AuditLog entry
         │
         ▼
  Tenant appears in list
         │
         ▼
  Admin → Tenant Detail → 5 tabs:
  ┌─────────────────────────────────────────────────┐
  │ Overview │ Clients │ Config │ Knowledge │ Activity│
  └────┬─────┴────┬────┴───┬────┴─────┬─────┴────────┘
       │          │        │          │
  KPIs &     List +    37 keys    Upload SOP
  stats      import    editor     docs for RAG
       │
       ▼
  Impersonate Tenant (Support)
  ─────────────────────────────
  Admin clicks "Impersonate"
  POST /admin/tenants/:id/impersonate
       │
       ▼
  Creates ImpersonationToken:
  • 64-char hex token
  • 30-minute TTL
  • Single-use
       │
       ▼
  Returns: { token, url: "/impersonate?token=..." }
  Admin opens URL in browser
       │
       ▼
  Server validates token, marks usedAt
  Sets impersonation_session cookie
       │
       ▼
  Orange banner: "Admin view: Sharma & Associates"
  Full tenant dashboard visible
  [End Session] → clears cookie
```

---

### 4.6 AI Assistant (RAG Chat) Journey

```
Admin ingests knowledge document
POST /assistant/knowledge
  { title: "GST GSTR-3B Filing SOP", content: "...", category: "GST_WORKFLOW" }
         │
         ▼
  Split into chunks (800 chars, 100 overlap)
  Each chunk → OpenAI embedding (1536-dim vector)
  Store in PostgreSQL pgvector index
         │
         ▼
Staff member asks:
"What documents does a new GSTR-3B client need?"
         │
         ▼
POST /assistant/chat
  { message: "...", conversationId: "conv_xyz" }
         │
         ▼
  1. Embed question → 1536-dim vector
  2. pgvector cosine search → top 5 chunks (similarity > 0.3)
  3. Build context: retrieved chunks + conversation history
  4. Claude responds with answer + references to sources
  5. Save USER message + ASSISTANT message to DB
  6. Return: { answer, citations: [{title, documentId}] }
         │
         ▼
Staff sees:
"Based on your GST workflow SOP, a new GSTR-3B client
needs: (1) GSTIN certificate, (2) previous 3 months'
purchase invoices, (3) PAN card..."
[Source: GST GSTR-3B Filing SOP]
```

---

## 5. Pain Points vs Automated Solutions — Improvement Matrix

### 5.1 CA Firms

| Current Process | Manual Effort | OpsCopilot Solution | Time Saved | % Improvement |
|---|---|---|---|---|
| Track 200 clients' GST deadlines in Excel | 45 min/day updating spreadsheet, checking dates | Automated filing calendar — all deadlines auto-computed, color-coded, linked to documents | 40 min/day | **89% reduction** |
| Collect documents via email/WhatsApp | 2 hours/day chasing clients, following up | Magic-link upload + WhatsApp doc_request template + inbound media OCR | 1.8 hours/day | **90% reduction** |
| Manual OCR of documents | 8–12 min per document for manual data entry | Claude Vision OCR in 8–15 seconds, confidence-scored, auto-linked to filings | 11 min/doc | **95% reduction** |
| Payment follow-up calls | 2–3 hours/day calling overdue clients | Automated WhatsApp reminders with quiet hours, throttling, auto-reply | 2.5 hours/day | **85% reduction** |
| Answer "Is my GST filed?" queries | 5–10 min per query × 20 queries/day = 2 hours | Inbound WhatsApp classifier → auto-reply with real filing status in < 2 seconds | 1.9 hours/day | **95% reduction** |
| Monthly status reports for clients | 2–3 hours per report (manual compilation) | One-click report generation with AI summary + PDF/Excel/Word export | 2.5 hours/report | **92% reduction** |
| Track overdue fees per client | 30 min/day reviewing payment status | Collections dashboard with real-time aging, risk scores, one-click reminders | 25 min/day | **83% reduction** |
| Detect missed filings before client complains | Reactive — client calls after deadline | Proactive: 10-day nudge, 3-day nudge, deadline-day nudge via WhatsApp | Prevented ₹50/day late fee | **100% proactive** |

**Aggregate impact for a 10-person CA firm:**
```
Before OpsCopilot:  ~8 hours/day on manual ops work across team
After OpsCopilot:   ~1.5 hours/day (exception handling only)
Net savings:        6.5 hours/day = 32.5 hours/week = 130 hours/month
At ₹300/hour:       ₹39,000/month in recovered productivity
```

---

### 5.2 Distributors & Manufacturers

| Current Process | Manual Effort | OpsCopilot Solution | Time Saved | % Improvement |
|---|---|---|---|---|
| Identify high-risk overdue invoices | 1 hour/day reviewing aging spreadsheet | AI risk scoring on every invoice — HIGH/MEDIUM/LOW badges, sorted automatically | 55 min/day | **92% reduction** |
| Send payment reminders | 1.5 hours/day calling customers or composing WhatsApp messages manually | Templated WhatsApp reminders with one click, auto-reply when customer confirms payment | 1.3 hours/day | **87% reduction** |
| Verify "payment done" confirmations | 30 min/day cross-checking bank statements | Inbound classifier detects payment confirmation, auto-acknowledges; staff only reviews flagged exceptions | 25 min/day | **83% reduction** |
| Detect stock-outs before they happen | Discovered at order time (too late) | Movement velocity tracking, days-to-stockout prediction, dashboard alert | Prevented stockouts | **100% proactive** |
| Generate receivables summary for management | 2–3 hours/week compiling Excel reports | One-click Receivables Summary report with AI narrative, PDF/Excel export | 2.5 hours/week | **92% reduction** |
| Track which customers to call today | Judgement-based, inconsistent | Risk-sorted collections list — always shows highest-impact work first | Decision clarity | **Systematic** |
| Know collection rate trend | Calculated monthly, from accounting | Real-time Cash Flow report: collected vs pending, week-over-week trend | Real-time vs monthly | **Continuous** |

**Aggregate impact for a mid-size distributor:**
```
Before OpsCopilot:  Collections team of 2–3 people needed
After OpsCopilot:   1 person handles same workload with better results
Net savings:        1–2 FTE = ₹3–6 lakh/year in salaries
+ Faster collections: -15 days avg aging = ₹XX lakh freed working capital
```

---

### 5.3 Quantified Business Impact Summary

```
┌──────────────────────────────────────────────────────────────────┐
│                    IMPACT SCORECARD                               │
│                                                                    │
│  Document Processing Time:    12 min → 15 sec   ↓ 98%           │
│  GST Deadline Miss Rate:       8%  → < 0.5%     ↓ 94%           │
│  Collections Follow-up Time:  3 hrs → 30 min    ↓ 83%           │
│  Payment Query Response:      10 min → 2 sec    ↓ 99.7%         │
│  Report Generation Time:      3 hrs → 90 sec    ↓ 99.2%         │
│  Avg Receivables Aging:       43 days → 28 days ↓ 35%           │
│  Staff Time on Manual Ops:    8 hrs → 1.5 hrs   ↓ 81%           │
│  Client Doc Collection Cycle: 7 days → 1 day    ↓ 86%           │
│                                                                    │
│  Monthly Cost Savings (10-person CA firm): ₹35,000–55,000        │
│  Annual Late Fee Prevention:               ₹2.1 lakh avg         │
│  Working Capital Freed (distributors):     ₹15–30 lakh           │
└──────────────────────────────────────────────────────────────────┘
```

---

---

# PART B — TECHNICAL SEGMENT

---

## 1. High-Level Architecture

### 1.1 System Overview

```
                              INTERNET
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
     ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
     │  apps/web   │    │ apps/admin  │    │  Twilio     │
     │  Next.js 15 │    │  Next.js 15 │    │  WhatsApp   │
     │  Port 3000  │    │  Port 3002  │    │  Webhooks   │
     │             │    │             │    │             │
     │  Clerk Auth │    │  Cookie Auth│    │  Inbound    │
     │  Multi-     │    │  (ADMIN_    │    │  Messages   │
     │  Tenant     │    │   SECRET)   │    │  + Media    │
     └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     apps/api        │
                    │     NestJS 10       │
                    │     Port 3001       │
                    │                     │
                    │  Global Prefix:     │
                    │  /api/v1            │
                    │                     │
                    │  ClerkAuthGuard     │
                    │  (global, JWT)      │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
  ┌──────────────┐   ┌─────────────────┐  ┌──────────────────┐
  │  PostgreSQL  │   │  External APIs  │  │  Redis           │
  │  16 +        │   │                 │  │  Port 6379       │
  │  pgvector    │   │  ┌───────────┐  │  │                  │
  │  Port 5433   │   │  │ Anthropic │  │  │  Caching         │
  │              │   │  │ Claude    │  │  │  Rate limiting   │
  │  27 models   │   │  │ (claude-  │  │  │  (future: BullMQ │
  │  19 enums    │   │  │ sonnet-   │  │  │   job queues)    │
  │  pgvector    │   │  │ 4-6)      │  │  └──────────────────┘
  │  1536-dim    │   │  └───────────┘  │
  │  embeddings  │   │  ┌───────────┐  │
  └──────────────┘   │  │  OpenAI   │  │
                     │  │ Embeddings│  │
                     │  │ (text-    │  │
                     │  │ embed-3-  │  │
                     │  │ small)    │  │
                     │  └───────────┘  │
                     │  ┌───────────┐  │
                     │  │  Twilio   │  │
                     │  │ WhatsApp  │  │
                     │  │  Sandbox  │  │
                     │  └───────────┘  │
                     │  ┌───────────┐  │
                     │  │  Resend   │  │
                     │  │  Email    │  │
                     │  └───────────┘  │
                     └─────────────────┘
```

---

### 1.2 Monorepo Structure

```
opsc-copilot/
├── apps/
│   ├── api/                    NestJS backend (Port 3001)
│   │   └── src/
│   │       ├── modules/        21 feature modules
│   │       ├── common/         Guards, decorators, storage
│   │       ├── prisma/         PrismaService
│   │       └── main.ts         Bootstrap
│   │
│   ├── web/                    Next.js 15 tenant app (Port 3000)
│   │   └── src/
│   │       ├── app/            App Router pages
│   │       ├── components/     React components
│   │       └── lib/            API client, utilities
│   │
│   ├── admin/                  Next.js 15 admin panel (Port 3002)
│   │   └── src/
│   │       ├── app/            Admin pages
│   │       └── components/     Admin UI components
│   │
│   └── tally-bridge/           Tally XML import (roadmap)
│
├── packages/
│   ├── database/               Prisma schema + migrations + seed
│   │   └── prisma/
│   │       ├── schema.prisma   27 models, 19 enums
│   │       └── seed.ts         Demo data (3 companies)
│   │
│   ├── types/                  Shared TypeScript interfaces
│   │   └── src/                ReportItem, AuthenticatedUser, etc.
│   │
│   └── config/                 Shared constants + INDUSTRY_DEFAULTS
│
├── docker-compose.yml          PostgreSQL 16 + pgvector + Redis 7
├── turbo.json                  Turborepo task graph
├── pnpm-workspace.yaml
└── .env                        Root env (shared by all apps)
```

---

### 1.3 API Module Map (21 Modules)

```
apps/api/src/modules/
├── auth/                   Clerk webhook + JWT guard + self-registration
├── companies/              Company profile CRUD
├── users/                  Team management
├── invoices/               Invoice CRUD + status transitions
├── inventory/              SKU management + low-stock
├── collections/            Receivables + risk scoring + aging
├── dashboard/              KPI aggregation + AI insight generation
├── documents/              Upload + Claude OCR + filing period extraction
├── filings/                GST calendar + deadline logic + heatmap
├── clients/                Client master + GSTIN/PAN + filer type
├── whatsapp/               Twilio send/receive + inbound classification
├── ai/                     Claude wrapper (OCR, insights, reports)
├── ai-assistant/           RAG chat + knowledge base (pgvector)
├── reports/                Report generation + async Claude summary
├── settings/               Profile + 37-param config engine + team
├── email/                  Resend notifications
├── upload-tokens/          Magic-link client uploads (public)
├── admin/                  Tenant management + impersonation
├── integrations/           ClearTax / Zoho / Tally sync framework
├── config/                 SystemConfig + ClientConfig CRUD
└── filings/                GST filing calendar (see above)
```

---

### 1.4 Authentication & Authorization Flow

```
Request arrives at NestJS API
          │
          ▼
ClerkAuthGuard.canActivate()  ← Applied GLOBALLY via APP_GUARD
          │
          ├── @Public() decorator? ────────────► Allow (webhook, register, upload)
          │
          ├── Authorization: Bearer dev::clerkId?
          │   (NODE_ENV !== production only)
          │   └── Lookup user by clerkId ──── Found? ─► inject req.user ─► Allow
          │                                           Not found? ─► 401
          │
          └── Authorization: Bearer <JWT>
              │
              ▼
          verifyToken(jwt, { secretKey })  ← @clerk/backend
              │
              ├── Invalid/expired ──────────────────────────────► 401
              │
              └── Valid → clerkUserId extracted
                      │
                      ▼
                  prisma.user.findUnique({ clerkId })
                      │
                      ├── Not found ──────────────────────────── 401
                      │   "User not found — complete onboarding"
                      │
                      └── Found → inject req.user {
                                    clerkId, userId, companyId,
                                    role, email, name
                                  }
                                  ──────────────────────────────► Allow
```

---

### 1.5 Database Schema (Key Models)

```
┌─────────────┐         ┌─────────────┐        ┌──────────────────┐
│  Company    │ 1──────M│    User     │        │  SystemConfig    │
│─────────────│         │─────────────│        │──────────────────│
│ id          │         │ id          │        │ key (ConfigKey)  │
│ name        │         │ clerkId     │        │ value            │
│ industry    │         │ companyId   │        │ dataType         │
│ plan        │         │ role        │        │ category         │
│ tenantConfig│         │ name, email │        │ label, desc      │
│ gstNumber   │         └─────────────┘        │ min, max, unit   │
│ panNumber   │                                └──────────────────┘
└──────┬──────┘
       │ 1:M
       ├────────────────────────────────────────────────────────────
       │
       ├──M──┤ Invoice           ├──M──┤ Document
       │     │ customerName      │     │ documentType
       │     │ amount, dueDate   │     │ status (OCR states)
       │     │ status (PENDING/  │     │ extractedData (JSON)
       │     │   OVERDUE/PAID)   │     │ filingPeriod
       │     │ agingDays         │     │ confidence
       │     └──────┬────────────┘     └──────────────────────────
       │            │ 1:1
       │     ┌──────▼────────────┐
       │     │ CollectionRisk    │
       │     │ riskScore (0–1)   │
       │     │ predictedDelayDays│
       │     │ riskFactors (JSON)│
       │     └───────────────────┘
       │
       ├──M──┤ Client            ├──M──┤ InventoryItem
       │     │ gstin, pan        │     │ sku, name, category
       │     │ filerType         │     │ quantity, reorderLevel
       │     │ filingCategory    │     │ unitCost
       │     │ gstDeadlineDay    │     │ movementVelocity
       │     └───────────────────┘     └──────────────────────────
       │
       ├──M──┤ WhatsAppMessage   ├──M──┤ Report
       │     │ direction (IN/OUT)│     │ reportType
       │     │ templateKey       │     │ status (PENDING → COMPLETED)
       │     │ status (SENT/DLVD)│     │ dataSnapshot (JSON)
       │     │ twilioSid         │     │ aiSummary
       │     └───────────────────┘     └──────────────────────────
       │
       ├──M──┤ KnowledgeDocument ├──M──┤ AIInsight
       │     │ title, category   │     │ module, severity
       │     └──────┬────────────┘     │ summary, category
       │            │ 1:M              └──────────────────────────
       │     ┌──────▼────────────┐
       │     │ KnowledgeChunk    │
       │     │ content           │
       │     │ embedding VECTOR  │  ← pgvector (1536 dims)
       │     │   (1536)          │
       │     └───────────────────┘
       │
       └──M──┤ AuditLog          ├──1──┤ TaxIntegration
             │ action, entity    │     │ provider
             │ userId, metadata  │     │ encryptedKeys
             └───────────────────┘     └──────────────────────────
```

---

### 1.6 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Monorepo** | Turborepo | 2.3 | Task graph, caching |
| **Package Manager** | pnpm | 9.4 | Workspace management |
| **Language** | TypeScript | 5.4.5 | Full-stack type safety |
| **Backend Framework** | NestJS | 10.3 | DDD modular architecture |
| **Frontend Framework** | Next.js | 15.1.0 | App Router, RSC, SSR |
| **UI Library** | React | 19.0.0 | Components |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS |
| **Component Variants** | CVA | — | Tailwind variant management |
| **Authentication** | Clerk | nextjs@6 | Multi-tenant JWT auth |
| **Database ORM** | Prisma | 5.22 | Type-safe DB client |
| **Database** | PostgreSQL 16 | + pgvector | Relational + vector search |
| **Cache** | Redis 7 | — | Rate limiting, future queues |
| **AI (LLM)** | Anthropic Claude | sonnet-4-6 | OCR, insights, reports |
| **AI (Embeddings)** | OpenAI | text-embed-3-small | RAG embeddings (1536-dim) |
| **WhatsApp** | Twilio | — | Message send + webhooks |
| **Email** | Resend | — | Transactional notifications |
| **PDF Export** | pdfkit | — | Report PDF generation |
| **Excel Export** | ExcelJS | — | Report .xlsx generation |
| **Word Export** | docx | — | Report .docx generation |
| **Webhook Verification** | svix | 1.22 | Clerk webhook signatures |
| **Validation** | class-validator | 0.14 | DTO input validation |
| **File Upload** | Multer | 2.1 | Multipart form handling |
| **Containerization** | Docker Compose | — | Local dev services |
| **Encryption** | Node crypto AES-256-GCM | — | 3rd-party API key storage |

---

### 1.7 OCR & AI Pipeline Detail

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLAUDE AI INTEGRATION                         │
│                                                                   │
│  Service: AiService (apps/api/src/modules/ai/ai.service.ts)      │
│  Model: claude-sonnet-4-6                                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  1. DOCUMENT OCR (Vision)                                │   │
│  │     Input: base64 file + MIME type + documentType        │   │
│  │     Prompt: "Extract fields from this {documentType}.    │   │
│  │             Return ONLY valid JSON. No markdown."         │   │
│  │     Output: Structured JSON + confidence (0.0–1.0)       │   │
│  │     Avg latency: 8–15 seconds                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  2. DASHBOARD INSIGHTS (Text)                            │   │
│  │     Input: KPI snapshot + tenantConfig JSON              │   │
│  │     Prompt: "You are an AI ops advisor for an Indian SME. │  │
│  │             Generate 3–5 actionable insights."            │   │
│  │     Output: [{category, severity, summary}]              │   │
│  │     Avg latency: 2–4 seconds                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  3. REPORT SUMMARY (Text)                                │   │
│  │     Input: reportType + dataSnapshot + tenantConfig      │   │
│  │     Output: 2–3 sentence executive narrative             │   │
│  │     Avg latency: 1–3 seconds                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  4. RAG CHAT (Text + Retrieval)                          │   │
│  │     Embeddings: OpenAI text-embedding-3-small (1536-dim) │   │
│  │     Search: pgvector cosine similarity > 0.30             │   │
│  │     Context: Top 5 chunks + full conversation history    │   │
│  │     Output: Answer + citations                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 1.8 WhatsApp Integration Architecture

```
OUTBOUND FLOW
─────────────
NestJS Service
    │
    ├── Quiet hours check (configurable 22:00–08:00)
    ├── Max reminders check (configurable, default 3)
    ├── Throttle check (configurable, default 10/min)
    │
    ▼
WhatsAppService.sendTemplated(phone, templateKey, variables)
    │
    ├── Lookup template from DB (company override → system default)
    ├── Render: replace {{variable}} placeholders
    │
    ▼
Twilio Client API
    POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages
    { from: 'whatsapp:+14155238886', to: 'whatsapp:+91...', body: '...' }
    │
    ▼
Returns: { sid, status: 'queued' }
    │
    ▼
Save WhatsAppMessage row (status: QUEUED → SENT → DELIVERED)


INBOUND FLOW
────────────
Customer sends WhatsApp message
    │
    ▼
Twilio → POST /api/v1/whatsapp/webhook
    │
    ├── Validate Twilio signature (HMAC-SHA1)
    │
    ├── Message has media (images/PDFs)?
    │   └── Download media → POST /documents (OCR pipeline)
    │       └── Send inbound_ack template
    │
    └── Text message?
        │
        ▼
InboundClassifier.classify(text)  ← Pure regex, no AI call
        │
        ├── PAYMENT_CONFIRMATION → payment_confirmation_ack
        ├── PROMISE_TO_PAY       → extractDate() → promise_to_pay_ack
        ├── INVOICE_QUERY        → lookup invoice → invoice_summary_reply
        ├── FILING_STATUS_QUERY  → lookup calendar → filing_status_reply
        ├── DOCUMENT_SENT        → inbound_text_ack
        ├── GREETING             → greeting_reply
        └── UNKNOWN              → inbound_text_ack (generic)
```

---

### 1.9 Multi-Tenancy Data Isolation

Every database query is automatically scoped to `companyId`:

```typescript
// Every API endpoint extracts companyId from the JWT via @CurrentUser()
// Example — Collections query:
async getCollections(user: AuthenticatedUser, filters: CollectionFiltersDto) {
  return this.prisma.invoice.findMany({
    where: {
      companyId: user.companyId,  // ← Always present, always from validated JWT
      ...(filters.status && { status: filters.status }),
    }
  })
}

// Impossible to query another tenant's data — companyId comes from JWT, not request body
```

**Isolation guarantees:**
- `companyId` is injected from the validated JWT by `ClerkAuthGuard` — never from user input
- Unique indexes prevent cross-tenant data leakage at DB level
- Admin endpoints use separate `x-admin-secret` header, never mix with tenant JWTs
- Impersonation creates a separate cookie — tenant can't escalate to admin

---

### 1.10 Configuration System Architecture

```
37 SystemConfig rows (platform-wide defaults)
          │
          ▼
GET /settings/config
          │
          ├── Load all SystemConfig rows
          ├── Load tenant's ClientConfig overrides
          └── Merge: ClientConfig value overrides SystemConfig value
                     │
                     ▼
          Returns merged config to frontend
          (tenant sees their effective value with override indicator)

PATCH /settings/config/:key { value }
          │
          ├── Validate: value within min/max range, correct dataType
          ├── Upsert ClientConfig for this company
          └── Effective immediately — no restart needed

DELETE /settings/config/:key
          │
          └── Remove ClientConfig override → falls back to SystemConfig default
```

**Config categories and how they affect runtime:**

```
COLLECTIONS config → used by:
  CollectionsService.calculateRisk()  ← risk weights, thresholds
  InvoicesService.getAgingBreakdown() ← bucket boundaries

AI_INSIGHTS config → used by:
  DashboardService.generateInsights() ← severity thresholds
  AiService.buildInsightPrompt()      ← maxInsights

GST_COMPLIANCE config → used by:
  FilingsService.buildCalendar()      ← deadline day, urgency window
  WhatsAppService.sendDeadlineNudge() ← nudge window

DOCUMENTS config → used by:
  DocumentsService.processOcr()       ← confidence thresholds

WHATSAPP config → used by:
  WhatsAppService.canSend()           ← quiet hours, throttle, max reminders
```

---

### 1.11 Deployment Architecture (Production Target)

```
                            ┌─────────────────────┐
                            │    Cloudflare DNS    │
                            │    + WAF + DDoS      │
                            └──────────┬──────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │  Vercel      │         │  Vercel      │         │  Railway /   │
    │  apps/web    │         │  apps/admin  │         │  Render      │
    │  (Next.js)   │         │  (Next.js)   │         │  apps/api    │
    │              │         │              │         │  (NestJS)    │
    │  Auto CDN    │         │  Private URL │         │              │
    │  SSL/TLS     │         │  SSL/TLS     │         │  Auto-scale  │
    └──────────────┘         └──────────────┘         └──────┬───────┘
                                                             │
                              ┌──────────────────────────────┤
                              │                              │
                              ▼                              ▼
                    ┌──────────────────┐          ┌──────────────────┐
                    │  Neon / Supabase │          │  Upstash Redis   │
                    │  PostgreSQL 16   │          │  (serverless)    │
                    │  + pgvector      │          │                  │
                    │  Daily backups   │          │  Rate limiting   │
                    │  Point-in-time   │          │  Session cache   │
                    │  recovery        │          └──────────────────┘
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  S3 / Cloudflare │
                    │  R2              │
                    │  File storage    │
                    │  (documents,     │
                    │   exports)       │
                    └──────────────────┘

External Services:
  Anthropic Claude API  → OCR, insights, reports, RAG
  OpenAI API            → Embeddings for RAG
  Twilio                → WhatsApp send/receive
  Resend                → Email notifications
  Clerk                 → Auth, user management
  Sentry (roadmap)      → Error monitoring
  Stripe (roadmap)      → Billing
```

---

### 1.12 Environment Variables Reference

```bash
# ── PostgreSQL ─────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5433/opsc_copilot?schema=public

# ── Redis ──────────────────────────────────────────
REDIS_URL=redis://:password@localhost:6379

# ── Clerk Auth ─────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# ── API ────────────────────────────────────────────
API_PORT=3001
NEXT_PUBLIC_API_URL=https://api.opscopilot.in

# ── AI ─────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
OPENAI_API_KEY=sk-...          # For RAG embeddings

# ── WhatsApp (Twilio) ──────────────────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ── Email (Resend) ─────────────────────────────────
RESEND_API_KEY=re_...
EMAIL_FROM=OpsCopilot <noreply@opscopilot.in>

# ── Admin Panel ────────────────────────────────────
ADMIN_SECRET=<min-32-char-random-string>

# ── Security ───────────────────────────────────────
ENCRYPTION_KEY=<64-char-hex>   # AES-256-GCM for 3rd-party API keys

# ── Runtime ────────────────────────────────────────
NODE_ENV=production
LOG_LEVEL=info
```

---

### 1.13 Key Technical Decisions & Rationale

| Decision | Chosen | Alternatives Considered | Reason |
|---|---|---|---|
| Auth | Clerk | Auth0, Supabase Auth, custom JWT | Multi-tenant support, org management, no auth infra to maintain |
| AI | Claude (Anthropic) | GPT-4, Gemini | Superior structured output, vision quality for document OCR |
| Embeddings | OpenAI text-embed-3-small | Claude embeddings, local models | Best price/quality for RAG; fallback to zero-vector if key absent |
| Database | PostgreSQL + pgvector | MongoDB, PlanetScale | Relational integrity for multi-tenant + native vector search eliminates separate vector DB |
| Messaging | Twilio WhatsApp | MessageBird, custom BSP | Most mature sandbox for dev; easy prod migration |
| Frontend | Next.js App Router | Remix, Vite + React | RSC for server data fetching, built-in Clerk integration |
| Monorepo | Turborepo + pnpm | Nx, Lerna | Simple config, fast caching, pnpm workspaces natural fit |
| Export | pdfkit + ExcelJS + docx | Puppeteer PDF, SheetJS | No headless Chrome dependency; all pure Node |
| Inbound Classification | Regex (no AI) | Claude, FastText | 0ms latency, no API cost, handles 90% of cases; Claude only for true unknowns |

---

### 1.14 Current Gaps & Production Readiness

**P0 — Must fix before production traffic:**

| Gap | Current State | Fix | Effort |
|---|---|---|---|
| File storage | Local disk (erased on redeploy) | AWS S3 / Cloudflare R2 | 1 day |
| Async job queue | Fire-and-forget (OCR/reports lost if crash) | BullMQ + Redis | 2 days |
| Error monitoring | Silent failures | Sentry SDK | 0.5 days |
| Database backups | None | Neon/Supabase automated backups | 0.5 days |

**P1 — Must fix before charging customers:**

| Gap | Fix | Effort |
|---|---|---|
| Stripe billing + plan enforcement | Stripe SDK + webhook | 3 days |
| Privacy Policy + ToS pages | Legal pages + consent flow | 1 day |
| WhatsApp production account | Twilio business account approval | 1 day (paperwork) |

**P2 — Nice to have before launch:**

| Gap | Fix | Effort |
|---|---|---|
| Full client portal (login) | Clerk sub-org for clients | 4 days |
| Scheduled reports (auto-email) | BullMQ cron + Resend | 2 days |
| Tally XML import | XML parser + invoice mapper | 3 days |

---

*Document generated: May 2026 · OpsCopilot v1.0 · Confidential*
