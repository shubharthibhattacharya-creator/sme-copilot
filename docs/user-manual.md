# OpsCopilot — User Manual
### For CA Firms and Tax Practices
**Version 1.1 | Last updated: June 2026**

---

## Contents

1. [What is OpsCopilot?](#1-what-is-opscopilot)
2. [Getting Started — First-Time Setup](#2-getting-started--first-time-setup)
3. [Dashboard](#3-dashboard)
4. [GST Filings](#4-gst-filings)
5. [Collections](#5-collections)
6. [Documents](#6-documents)
7. [GST Reconciliation](#7-gst-reconciliation)
8. [Reports](#8-reports)
9. [AI Assistant](#9-ai-assistant)
10. [WhatsApp Integration](#10-whatsapp-integration)
11. [Settings](#11-settings)
12. [Team Management](#12-team-management)
13. [Roles and Permissions](#13-roles-and-permissions)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. What is OpsCopilot?

OpsCopilot is a practice management platform built specifically for CA firms and tax practices in India. It brings together client filing tracking, receivables management, document collection, WhatsApp communication, and AI-assisted compliance queries into one place.

**Who uses it:**
- **Principal / Partner** — Reviews firm health, approves actions, generates reports
- **Senior Accountant / Manager** — Manages filings calendar, follows up on documents
- **Junior Staff / Articled Assistant** — Handles day-to-day document uploads, client reminders

**What it does not replace:**
OpsCopilot is a management and coordination layer — it does not replace your existing GST filing software (ClearTax, Zoho, Tally). It tracks what needs to be done and helps your team execute faster.

---

## 2. Getting Started — First-Time Setup

### Step 1 — Accept Your Invitation

Your firm's admin will send you an email invitation. Click the link in the email, set your password, and you will be redirected to the onboarding wizard.

If you are the principal setting up your firm for the first time, you will receive setup credentials from OpsCopilot support.

---

### Step 2 — Onboarding Wizard

The wizard has 5 steps. You can pause at any step and come back later — your progress is saved.

**Step 1 — Firm Details**

Fill in your firm's information:

| Field | Required | Notes |
|---|---|---|
| Firm Name | Yes | Pre-filled from registration |
| GSTIN | Yes | 15-character GST number, auto-capitalised |
| PAN | Yes | 10-character PAN, auto-capitalised |
| Phone | No | Used for firm-level contact |
| Office Address | No | Appears on documents and reports |

Click **Save & Continue** when done.

---

**Step 2 — Add Clients**

This is where you add the clients whose GST filings and payments your firm manages.

*To add a client:*
1. Enter the client's firm name
2. Enter their GSTIN (optional but recommended — used for filing tracking)
3. Select their Filer Type:
   - **Monthly** — files GSTR-1 and GSTR-3B every month
   - **Quarterly** — QRMP scheme filers
   - **Annual** — only annual returns (typically composition dealers)
4. Click **Add Client**

You can add multiple clients before clicking Continue. If you have many clients, you can also import them via CSV after setup from Settings > Clients.

Click **Continue** when you have added at least your primary clients. You can add more at any time.

---

**Step 3 — WhatsApp Setup**

This step connects your firm's WhatsApp number so OpsCopilot can send reminders and receive documents from clients automatically.

*To set up WhatsApp:*
1. Save the Twilio sandbox number shown on screen in your phone contacts
2. Send the join code shown (e.g., "join copper-valley") to that number via WhatsApp
3. Enter your WhatsApp-registered phone number in the field provided
4. Click **Verify**

If you want to skip WhatsApp for now and set it up later, click **Skip**. You can always come back to this from Settings > Integrations.

---

**Step 4 — Tax Software**

This step shows available integrations (ClearTax, Zoho Books, Tally). These will be available in a future release. Click **Continue** to proceed.

---

**Step 5 — Review & Go to Dashboard**

Review your setup summary and click **Go to Dashboard**.

---

## 3. Dashboard

The Dashboard is the first screen you see after logging in. It gives you a firm-wide health check at a glance.

### KPI Cards (top row)

There are four metric cards:

| Card | What it shows |
|---|---|
| Total Receivables | All unpaid invoices (pending + overdue) |
| Overdue Amount | Amount across all overdue invoices |
| Overdue Invoices | Count of overdue invoices |
| Avg Days Overdue | Average age of your overdue invoices |

Each card shows:
- **Current value** (large number)
- **Trend arrow** — up/down/flat vs. the previous month
- **Sparkline** — 6-month mini chart

A green arrow is good (receivables going down, collections trending up). A red arrow needs attention.

---

### AI Insights

Below the KPI cards is the **AI Insights** panel. This shows 2–3 automatically generated observations about your firm's current state. Examples:

> "3 clients account for 78% of your overdue amount — prioritise Kapoor Exports, Mehta Traders, and Singh & Co."

> "GST compliance readiness at 62% — 4 clients have not submitted documents for the current period."

Insights are refreshed automatically when meaningful changes happen (payments received, documents uploaded). You can also click **Refresh Insights** at any time to get the latest.

Insights are colour-coded by severity:
- **Blue (INFO)** — Observation, no urgent action needed
- **Amber (WARNING)** — Needs attention in the next few days
- **Red (CRITICAL)** — Immediate action required

---

### Compliance At Risk

This section shows clients whose GST filings for the current period are in risk. A client appears here if:
- Their readiness score is below 50%
- They have missed 2 or more consecutive months
- The deadline is within 5 days

Click any client row to jump directly to their filing details.

---

### Top Overdue Customers

A ranked table of clients with the highest overdue amounts. Clicking the phone icon next to a client opens a reminder flow. Clicking the name opens their invoice history.

---

## 4. GST Filings

**Navigation: GST Filings** (second item in the left sidebar)

This is the core workflow for CA firms. It shows every client's filing status for the current GST period (GSTR-1 + GSTR-3B).

---

### Understanding the Filing Table

Each row represents one client for the current period. Columns:

| Column | Meaning |
|---|---|
| Client | Client name and GSTIN |
| Period | Filing period (e.g., Apr 2026) |
| Filer Type | Monthly / Quarterly |
| Deadline | Last date for filing |
| Status | Current filing status |
| Readiness | Document readiness score (0–100%) |
| Last Reminder | Date of last WhatsApp reminder sent |

**Status colours:**
- **Green — FILED:** Return has been filed. No action needed.
- **Amber — PENDING:** Period is open and documents are being collected.
- **Red — OVERDUE:** Deadline has passed without filing.
- **Red border — AT RISK:** Deadline is within 5 days and readiness is below 80%.

---

### Readiness Score

The coloured progress bar next to each client shows their document readiness:
- **Green (80–100%)** — Almost all required documents received
- **Amber (50–79%)** — Some documents missing
- **Red (0–49%)** — Most documents not yet received

Hover over the bar (or click the row) to see exactly which documents are missing.

---

### Flame Badge

A flame icon next to a client's name means they have missed 2 or more consecutive filing periods. These clients need proactive follow-up.

---

### Filtering

Use the tab filters above the table to narrow the view:
- **All** — Every client
- **Filed** — Only completed filings
- **Pending** — In progress
- **Overdue** — Past deadline
- **At Risk** — Approaching deadline with low readiness

Use the search box to find a specific client by name.

---

### Client Detail Drawer

Click any row to open the detail panel on the right side. This shows:
- Client's GSTIN and filer type
- Current period and deadline
- Readiness bar with the specific list of missing documents
- Consecutive missed periods warning (if applicable)
- Date of the last WhatsApp reminder sent
- Two action buttons: **Mark as Filed** and **Request Documents**

**Mark as Filed:** Use this when the return has been filed in your GST portal. This updates the status to FILED in OpsCopilot and records the filing in the audit trail.

**Request Documents:** Sends a WhatsApp message to the client listing the specific documents that are still missing. The client receives a link where they can upload documents directly.

---

### Bulk Actions

To take action on multiple clients at once:
1. Check the boxes next to the clients you want to act on (or use the header checkbox to select all visible)
2. The bulk action toolbar appears at the top of the table
3. Choose an action:

**Request Documents (blue button)**
Opens a modal listing selected clients. You can deselect any client you do not want to message. Toggle "Send via WhatsApp" to also send the request over WhatsApp. Click **Send Requests**.

**Deadline Nudge (amber button)**
Sends a deadline reminder to selected clients via WhatsApp. The message previews in the modal before sending. Use this 2–3 days before the deadline.

**Mark as Filed (green button)**
Marks selected clients as FILED. An amber warning banner reads: *"This cannot be undone."* Review the list carefully and click **Confirm** to proceed.

---

### Export to CSV

Click the **Export CSV** button (top right, above the table) to download the current view as a spreadsheet. The export respects the active filter — if you are viewing "Overdue" clients, only those rows are exported. Useful for sharing a status update with your team or client.

---

### Filing Heatmap

Toggle to the **Heatmap** view to see 6 months of filing history across all clients in a grid format. Green cells = filed, amber = pending, red = overdue, grey = not applicable. This is useful for identifying clients with a persistent pattern of late filing.

---

## 5. Collections

**Navigation: Collections**

The Collections module tracks all client invoices — fees outstanding, overdue dues, and payment follow-up.

---

### Invoice List

The main view shows all active invoices sorted by risk (highest overdue first). Each invoice shows:
- Client name and phone number
- Invoice amount
- Due date and days overdue
- Risk level: HIGH / MEDIUM / LOW (based on aging, amount, and payment history)

Use the filters at the top to narrow by status (Pending, Overdue, Paid) or risk level.

---

### Aging Breakdown

The chart at the top of the Collections page shows your receivables split into aging buckets:
- 0–30 days
- 31–60 days
- 61–90 days
- 90+ days

A healthy practice should have the bulk of receivables in the 0–30 bucket. Significant amounts in the 60+ buckets indicate follow-up is needed.

---

### Sending a Reminder

Click the **Send Reminder** button on any invoice to:
1. Send a WhatsApp payment reminder to the client (if WhatsApp is enabled)
2. Record the reminder in the audit trail with a timestamp

**Important:** OpsCopilot enforces a minimum interval between reminders per invoice (default: 7 days). If you try to send a reminder before the interval has passed, you will see a message like: *"Reminder already sent on 20 May 2026. Next reminder allowed after 7 days."*

This protects your firm's reputation — clients who receive daily reminders often stop responding entirely. The interval can be adjusted in Settings > Rules.

---

### Viewing Invoice History

Click any invoice row to open the detail view. This shows the full audit trail — when the invoice was created, when reminders were sent, and any status changes. Useful for checking "did we actually follow up with this client last month?"

---

## 6. Documents

**Navigation: Documents**

The Documents module is where all client-submitted documents are tracked, classified, and verified.

---

### How Documents Come In

Documents can arrive three ways:
1. **WhatsApp upload** — A client clicks a link in a WhatsApp message and uploads directly from their phone
2. **Email upload** — Same link sent via email
3. **Manual upload** — Your staff uploads a document on the client's behalf from this screen

---

### Document List

The table shows every document with the following columns:

| Column | What it shows |
|---|---|
| File | Original filename |
| Type | Document type (Invoice, GST Return, etc.) |
| **Client** | The client this document belongs to |
| Purpose | How OpsCopilot has classified this document (see below) |
| Upload | Saved status |
| OCR | Extraction status (Done / Review / Extracting / Failed / Pending) |
| Sync | Whether it has been pushed to ClearTax / Zoho / Tally |
| Size | File size |
| Date | Upload date |
| By | Who uploaded it |

---

### Filtering Documents

Use the filter bar above the table to narrow results by any combination of:

- **Type** — Show only specific document types, e.g. "GST Return" or "Client Purchase Invoice"
- **Status** — Show only documents at a specific OCR stage, e.g. "Needs Review"
- **Purpose** — Show only documents of a specific purpose, e.g. "Client doc" (tax preparation)

Click **Clear filters** to reset all filters and show the full list.

---

### Document Purpose (Classification)

OpsCopilot automatically classifies every uploaded document into one of four purposes:

| Badge | Purpose | Meaning |
|---|---|---|
| **Fee invoice** (teal) | RECEIVABLE | A fee invoice your firm issued to a client |
| **Client doc** (purple) | TAX_PREPARATION | A document the client submitted for filing purposes |
| **Firm record** (blue) | FIRM_RECORD | An internal firm document |
| **Needs review** (amber) | UNKNOWN | Classification could not be determined — requires manual review |

If a document shows **"Needs confirmation"** in orange, it means OpsCopilot detected a GSTIN in the document that does not match the client it was filed under. Review the document and either reassign it to the correct client or confirm the GSTIN is correct.

---

### Document Status

Each document moves through these states:

| Status | Meaning |
|---|---|
| Uploaded | Received, OCR processing in progress |
| Verified | Data extracted, reviewed and confirmed |
| Needs Review | OCR extracted data but confidence is low — staff review required |
| Rejected | Document was incorrect (wrong period, wrong client, illegible) |

---

### OCR and Data Extraction

When a document is uploaded, OpsCopilot automatically extracts key fields using AI:
- Invoice number and date
- Client and vendor names
- Total amount, GST amount, IGST/CGST/SGST breakdown
- GSTIN and PAN numbers

The extracted data is shown next to the document. A **confidence score** (0–100%) shows how certain the AI was. Documents with confidence below 70% are flagged for your review.

**To verify a document:**
1. Click the document in the list
2. Review the extracted fields against the original document (shown side by side)
3. Correct any fields if needed
4. Click **Verify**

---

### Document Requests

When you use **Request Documents** from the GST Filings screen, a document request is created here and linked to that client and period. The request shows:
- Which documents were requested
- When the request was sent
- Whether the client has uploaded anything against the request

Use the **Requests** tab in Documents to see all pending requests and follow up.

---

## 7. GST Reconciliation

**Navigation: Reconciliation**

The Reconciliation module helps you verify that the ITC (Input Tax Credit) your clients have claimed in their GSTR-3B matches what their suppliers have actually reported in GSTR-2B.

---

### Why Reconciliation Matters

The GST department cross-checks every GSTR-3B with the auto-populated GSTR-2B. If your client has claimed ITC for an invoice that is not in GSTR-2B (because the supplier hasn't filed, or filed incorrectly), the claim gets rejected and a notice may follow. Catching this before filing saves the client from notices and interest.

---

### Running a Reconciliation

1. Download the GSTR-2B JSON file for the client from the GST portal (Filing → Download → GSTR-2B)
2. Go to **Reconciliation** in OpsCopilot
3. Click **Upload GSTR-2B**
4. Select the client and the filing period
5. Upload the JSON file
6. OpsCopilot processes the file and matches each line against purchase invoices in your system

---

### Reading the Results

Each row in the reconciliation result represents one invoice in the GSTR-2B:

| Status | Colour | Meaning | What to do |
|---|---|---|---|
| **Matched** | Green | Invoice found in books, amounts agree | Nothing — this is correct |
| **Unmatched** | Red | Invoice is in GSTR-2B but not in your books | Ask the client if this purchase was booked |
| **Partial** | Amber | Invoice found but amounts differ (rounding, etc.) | Review and adjust the booking |
| **Duplicate** | Orange | Same invoice appears more than once | Flag to the supplier |

The summary at the top shows:
- Total ITC available in GSTR-2B
- Total ITC booked in your system
- **Net difference** — this is the amount the client is at risk of losing if not reconciled

---

### Exporting the Reconciliation

Click **Export** to download the full line-item reconciliation as an Excel file. Share this with your client so they can follow up with suppliers who have not filed.

---

## 8. Reports

**Navigation: Reports**

The Reports module generates formatted reports for your own review or to share with clients.

---

### Available Reports

| Report | What it covers |
|---|---|
| MIS Monthly | Month-end summary of receivables, payments, and overdue position |
| Client Health | Per-client scorecard with payment history, aging, and risk rating |
| GST Filing Status | Filing completion status across all clients for a period |
| Overdue Analysis | Detailed breakdown of overdue amounts by client and aging bucket |

---

### Generating a Report

1. Click the report type you want
2. Select the period (month/quarter)
3. Click **Generate**

Report generation takes 15–30 seconds. Once ready, you can:
- **View online** — Opens a formatted view in the browser
- **Download PDF** — Downloads a formatted PDF version
- **AI Summary** — Adds a 3–5 sentence executive summary written by AI at the top of the report, highlighting the key findings and one actionable recommendation

Reports are stored and can be regenerated at any time.

---

## 9. AI Assistant

**Navigation: AI Assistant**

The AI Assistant is an internal knowledge tool for your staff. It answers questions about your firm's SOPs, compliance procedures, and general GST/TDS/ITR knowledge.

---

### What It Can Answer

The assistant works in two modes:

**From your firm's knowledge base:** If you have uploaded your firm's SOPs, checklists, and procedure documents (see below), the assistant searches these first and answers based on your specific procedures. It cites the source document.

**From general knowledge:** For questions not covered by your uploaded documents, the assistant draws on general CA/accounting knowledge. It will clearly say when it is answering from general knowledge rather than your SOPs.

---

### How to Use It

1. Click **AI Assistant** in the sidebar
2. Type your question in the chat box
3. The assistant responds with an answer and shows which documents it referred to (if applicable)

Example questions:
- "What documents do we need from a composition dealer for their annual return?"
- "What is the late fee structure for GSTR-3B for a small taxpayer?"
- "What is our procedure for onboarding a new GST client?"
- "How do we handle a client who has missed 3 consecutive GSTR-1 filings?"

**Important:** Always verify regulatory details independently before filing. The assistant is a reference tool, not a substitute for professional judgement.

---

### Starting a New Conversation

Each conversation keeps context for up to 6 exchanges. For a new topic, click **New Conversation** rather than continuing an old thread — this gives the assistant a clean slate and produces better answers.

---

### Uploading Your Firm's SOPs (Admin / Principal only)

The assistant becomes significantly more useful when you upload your firm's own procedures. To add documents to the knowledge base:

1. Go to **Settings > AI Knowledge Base** (or ask your OpsCopilot admin to do this from the admin panel)
2. Click **Add Document**
3. Paste or type your procedure content, give it a title, and assign a category (e.g., "GST Procedures", "Client Onboarding", "TDS")
4. Click **Save**

The document is processed in the background and becomes searchable within a few seconds. You can add as many procedure documents as needed.

---

## 10. WhatsApp Integration

**Navigation: Settings > Integrations**

WhatsApp is used for three things in OpsCopilot:
1. Sending payment reminders to clients
2. Sending GST deadline nudges and document requests
3. Receiving documents sent by clients

---

### How Clients Receive Messages

Messages are sent from the Twilio WhatsApp Sandbox number. Clients must have joined your sandbox (sent the join code to the sandbox number) to receive messages. This is a limitation of the WhatsApp sandbox — in a production Twilio account with WhatsApp Business API approval, this step is not required.

---

### How Clients Send Documents

When you send a **Request Documents** message from the Filings screen, the client receives a WhatsApp message with a unique upload link. The client clicks the link, which opens a simple web page where they can upload files from their phone or computer. The uploaded files appear immediately in your Documents screen.

---

### Auto-Reply

When a client replies to a WhatsApp message, OpsCopilot reads the intent automatically:
- If they confirm payment ("paid", "done", "transfer kiya") — logged as a payment confirmation
- If they promise to pay ("kal deta hun", "by Friday") — logged with the promise date
- If they send a document — routed to the Documents screen for processing
- If they send a general query — replied to with a polite acknowledgement

---

### WhatsApp Message Limits

To protect your business reputation and comply with WhatsApp policies, OpsCopilot enforces:
- Maximum messages per hour (configurable in Settings > Rules)
- Quiet hours (no messages sent outside 9am–7pm by default, configurable)
- Daily message limit per client

---

## 11. Settings

**Navigation: Settings (gear icon at bottom of sidebar)**

### Settings > Clients

Add, edit, or deactivate clients. For each client you can set:
- Client name and GSTIN
- Filer type (Monthly / Quarterly / Annual)
- Contact phone and email (used for reminders)
- Active/inactive status

To import clients in bulk, click **Import CSV**. Download the template, fill in your client list, and upload.

---

### Settings > Filing Templates

Configure the document checklist for each filer type. These are the documents that OpsCopilot will ask clients to submit when you click "Request Documents."

Default templates are pre-configured:
- **Monthly filer:** Sales register, Purchase register, Bank statement, GSTR-2B reconciliation
- **Quarterly filer:** Quarterly sales register, ITC register, Bank statement
- **Annual filer:** Annual P&L, Balance sheet, Capital account

You can add, remove, or rename items in each template. Changes take effect immediately for all future document requests.

---

### Settings > Rules

Configure the business rules that govern how OpsCopilot behaves:

| Rule | Default | What it controls |
|---|---|---|
| Reminder interval (days) | 7 | Minimum days between payment reminders per invoice |
| Max reminders per invoice | 5 | Total reminder limit before requiring manual approval |
| GST deadline day | 20 | The day of month that GSTR-3B is due |
| Deadline urgency (days) | 5 | How many days before deadline a filing is flagged as "at risk" |
| Late fee rate (per day) | ₹50 | Used to calculate late fee exposure shown in the Filings summary |
| WhatsApp quiet hours | 9:00–19:00 | No automated messages outside these hours |

---

### Settings > Integrations

Configure external connections:
- **WhatsApp / Twilio** — Twilio Account SID, Auth Token, and WhatsApp number
- **Tax software** — ClearTax, Zoho, Tally (coming soon)

---

### Settings > Profile

Update your own name and profile. Your email address is managed through the login provider and cannot be changed from here.

---

## 12. Team Management

**Navigation: Settings > Team**

### Adding a Team Member

1. Go to Settings > Team
2. Click **Invite Member**
3. Enter their name and email address
4. Select their role (see Roles below)
5. Click **Send Invite**

The team member will receive an email invitation. Once they accept and set their password, they can log in immediately.

**Note:** If you invited someone and they haven't received the email, check the Pending Invitations section. Click **Resend** next to their entry. If you entered the wrong email, click **Revoke** and send a new invitation.

---

### Removing a Team Member

Click the **Remove** button next to a team member's name. You will be asked to confirm. Removed members can no longer log in. Their historical actions and audit records are preserved.

**Note:** You cannot remove the last admin user. The system will prevent this to ensure you always have at least one account with full access.

---

### Changing a Role

Click the role dropdown next to a team member's name and select the new role. The change takes effect immediately — the team member will see the updated access on their next page load.

---

## 13. Roles and Permissions

| Role | What they can access |
|---|---|
| **Admin** | Everything, including Settings, Team Management, and system configuration |
| **Manager** | Dashboard, Filings, Collections, Documents, Reports, AI Assistant — cannot change Settings or invite users |
| **Staff** | Dashboard, Filings (view + basic actions), Documents (upload and view), AI Assistant — no bulk actions, no report generation |

---

## 14. Frequently Asked Questions

**Q: A client says they sent us documents on WhatsApp but I can't see them.**

Check that the client messaged the Twilio sandbox number directly, not your personal number. Also confirm the client has joined the sandbox (sent the join code). Documents sent before joining the sandbox are not received.

---

**Q: The AI Insights haven't refreshed even though we received a payment.**

Insights refresh automatically when data changes, but there can be a few minutes of delay. Click the **Refresh Insights** button on the Dashboard to force an immediate update.

---

**Q: I marked a client as Filed by mistake. Can I undo it?**

Mark as Filed cannot be automatically undone as it records an audit entry. Contact your admin or raise a support request — a manual correction can be made to the record.

---

**Q: Why can't I send a reminder to a client — the button is not working?**

If a reminder was sent within the configured interval (default 7 days), the system blocks the next reminder. You will see a message explaining when the next reminder can be sent. If you need to send urgently regardless, your admin can adjust the reminder interval in Settings > Rules.

---

**Q: The readiness score says 100% but the client has not sent all documents.**

Readiness is calculated based on the filing template assigned to that client's filer type. If a document type is not in the template, it does not count against readiness. Check Settings > Filing Templates to ensure the template for that filer type matches what you actually need.

---

**Q: Can two staff members work on the same client's filing at the same time?**

Yes. The system does not lock records. If two people mark the same client as Filed simultaneously, the second action will succeed but is redundant — the status is already Filed. Coordinate via your firm's internal process.

---

**Q: How do I add a new type of return (e.g., GSTR-9 annual)?**

Currently the calendar tracks GSTR-1 and GSTR-3B cycles (monthly and quarterly). Annual return tracking (GSTR-9) will be added in a future release.

---

**Q: Where is the data stored? Is it secure?**

All data is stored in an encrypted database hosted in India (Railway infrastructure). Data is isolated per firm — your clients and financial data are completely separate from other firms on the platform. Access is secured via email + password login with 2FA available.

---

**Q: The AI Assistant gave me an answer about GST that doesn't seem right.**

The assistant can make mistakes on regulatory details, especially for edge cases. Always verify important compliance answers from official GSTN portals or your reference texts before acting. If the assistant is consistently wrong about a specific topic, upload a corrected SOP document to the knowledge base — it will learn from your firm's procedures.

---

*For technical support, contact your OpsCopilot account manager or email support@opscopilot.in*

*This manual covers platform version 1.0. Features marked "coming soon" will be released in subsequent updates.*
