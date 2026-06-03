# OpsCopilot

AI-powered operations copilot for Indian SMEs — CA firms, distributors, and manufacturers. Handles collections intelligence, GST/TDS compliance tracking, document OCR & classification, GSTR-2B reconciliation, WhatsApp reminders, inventory management, a RAG-powered AI assistant, GST filing calendar, client magic-link uploads, email notifications, and a full internal admin panel — all in a multi-tenant SaaS architecture deployed on Railway.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Detailed File Tree](#4-detailed-file-tree)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Business Logic & Flow Diagrams](#7-business-logic--flow-diagrams)
8. [Frontend — Pages & Components](#8-frontend--pages--components)
9. [Configuration System](#9-configuration-system)
10. [AI & Integrations](#10-ai--integrations)
11. [Environment Variables](#11-environment-variables)
12. [Local Development Setup](#12-local-development-setup)
13. [Seed Data](#13-seed-data)
14. [Scripts Reference](#14-scripts-reference)
15. [Project Status](#15-project-status)
16. [Roadmap](#16-roadmap)
17. [Competitive Differentiation](#17-competitive-differentiation)
18. [MVP Gap Analysis](#18-mvp-gap-analysis)
19. [Missing Winning Features](#19-missing-winning-features)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                │
│                                                                          │
│  ┌────────────────────────────────────────┐  ┌──────────────────────┐   │
│  │  apps/web  (Next.js 15 — port 3000)    │  │  apps/admin          │   │
│  │                                        │  │  (Next.js 15 — 3002) │   │
│  │  Dashboard · Collections · Filings     │  │                      │   │
│  │  Documents · WhatsApp · Reports        │  │  Tenant mgmt         │   │
│  │  AI Assistant · Settings · Onboarding  │  │  Config overrides    │   │
│  │  Impersonation banner                  │  │  Knowledge base      │   │
│  │  Client upload page (/upload/[token])  │  │  Platform stats      │   │
│  └────────────────────┬───────────────────┘  └──────────┬───────────┘   │
└───────────────────────┼────────────────────────────────┼────────────────┘
                        │ HTTPS  (Clerk JWT)              │ HTTPS  (x-admin-secret)
┌───────────────────────▼────────────────────────────────▼────────────────┐
│                        API LAYER  (NestJS 10 — port 3001)               │
│                        Base path: /api/v1                               │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Collections│ │Dashboard │ │Documents │ │ Filings  │ │  AI Assistant│  │
│  │  + Risk  │ │  + KPIs  │ │  + OCR   │ │ Calendar │ │ (RAG + Chat) │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ WhatsApp │ │ Invoices │ │ Reports  │ │  Clients │ │Upload Tokens │  │
│  │ (Twilio) │ │          │ │          │ │(GST/TDS) │ │  (public)    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Settings │ │  Config  │ │  Email   │ │  Admin   │ │    Prisma    │  │
│  │ (Profile,│ │ @Global()│ │ (Resend) │ │  Module  │ │   ORM Layer  │  │
│  │  Team)   │ │          │ │          │ │(AdminGrd)│ │              │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└──────────┬──────────────────┬──────────────────┬───────────────────────┘
           │                  │                  │
┌──────────▼──┐    ┌──────────▼────┐   ┌─────────▼──────────────────────┐
│ PostgreSQL  │    │     Redis      │   │   External Services             │
│ 16 +pgvecto │    │  Cache +       │   │                                 │
│             │    │  Rate limit    │   │  Anthropic Claude               │
│  27+ tables │    │                │   │  OpenAI  (embeddings)           │
│  vector     │    │                │   │  Clerk   (auth — web app only)  │
│  1536-dim   │    │                │   │  Twilio  (WhatsApp)             │
└─────────────┘    └────────────────┘   │  Resend  (transactional email)  │
                                        └─────────────────────────────────┘
```

### Multi-Tenancy Model

Every row in every table is scoped to a `companyId`. All API endpoints extract the company from the authenticated Clerk JWT (or, for public upload endpoints, from a validated `UploadToken`), so data is fully isolated between tenants. No cross-tenant queries are possible at the application layer.

### Request Flow — Authenticated (web app)

```
Browser Request
      │
      ▼
Next.js Middleware (clerkMiddleware)
      │  Validates session, redirects unauthenticated to /sign-in
      ▼
Next.js Server Component
      │  getToken() → Clerk JWT
      │  fetch(`${API_URL}/api/v1/...`, { Authorization: Bearer })
      ▼
NestJS ClerkGuard
      │  Validates JWT, resolves User + Company from DB
      │  Injects AuthenticatedUser via @CurrentUser()
      ▼
Controller → Service
      │  All Prisma queries: WHERE companyId = user.companyId
      ▼
Prisma ORM → PostgreSQL
```

### Request Flow — Public upload (client magic link)

```
Client opens /upload/[token]  (no Clerk auth required)
      │
      ▼
POST /api/v1/public/upload/:token  (multipart)
      │  UploadTokensService validates token (not expired)
      ▼
Document created, OCR triggered, token.usedAt set
```

### Request Flow — Admin panel

```
Admin opens apps/admin (port 3002)
      │
      ▼
Next.js middleware checks admin_session cookie
      │  Cookie absent/invalid → redirect to /login
      ▼
Admin page → adminApi.*() → POST/GET/PATCH /api/v1/admin/*
      │  NestJS: @Public() bypasses ClerkGuard
      │  @UseGuards(AdminGuard) checks x-admin-secret header
      ▼
AdminService → Prisma
```

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 15.1.0 | App Router, SSR, RSC |
| **Frontend** | React | 19.0.0 | UI components |
| **Frontend** | Tailwind CSS | 3.4 | Utility-first styling |
| **Frontend** | Recharts | 2.12 | Aging/KPI charts |
| **Frontend** | Lucide React | 0.400 | Icons |
| **Backend** | NestJS | 10.3 | Modular API framework |
| **Backend** | TypeScript | 5.9 | Full-stack type safety |
| **Auth** | Clerk | nextjs@6, backend@1 | Multi-tenant auth, JWT (web app only) |
| **Admin Auth** | Cookie-based | — | `admin_session` httpOnly cookie, `ADMIN_SECRET` |
| **Database** | PostgreSQL 16 (Neon — production) | pgvector/pgvector:pg16 (local Docker) | Primary data store — automated backups, point-in-time recovery via Neon |
| **ORM** | Prisma | 5.15 | Type-safe DB client |
| **Vector DB** | pgvector | pg16 extension | Embedding storage + cosine search |
| **Cache** | Redis 7 | ioredis 5 | Response caching, rate limiting |
| **AI** | Anthropic Claude | claude-sonnet-4-6 | OCR, insights, RAG answers |
| **Embeddings** | OpenAI | text-embedding-3-small | RAG vector creation (1536 dims) |
| **WhatsApp** | Twilio | ^6.0.2 | Message delivery + webhooks |
| **Email** | Resend | — | Document upload, OCR complete, deadline reminders |
| **Build** | Turborepo | 2.9 | Monorepo task orchestration |
| **Package Mgr** | pnpm | 9.4 | Workspace management |
| **Validation** | class-validator | 0.14 | DTO validation |
| **Transforms** | class-transformer | 0.5 | Request/response mapping |
| **File Upload** | Multer | 2.0 | `FileInterceptor` for documents |
| **Webhooks** | svix | 1.22 | Clerk webhook signature validation |

---

## 3. Monorepo Structure

```
opsc-copilot/
├── apps/
│   ├── api/          # NestJS REST API  →  http://localhost:3001/api/v1
│   ├── web/          # Next.js frontend →  http://localhost:3000
│   └── admin/        # Next.js admin panel → http://localhost:3002
├── packages/
│   ├── database/     # Prisma schema, migrations, seed script
│   ├── config/       # Shared configuration constants
│   └── types/        # Shared TypeScript types
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env              # Root env file (all apps read from here)
```

**Workspace package names:**

| Package | Name |
|---------|------|
| `apps/api` | `@opsc/api` |
| `apps/web` | `@opsc/web` |
| `apps/admin` | `@opsc/admin` |
| `packages/database` | `@opsc/database` |
| `packages/config` | `@opsc/config` |
| `packages/types` | `@opsc/types` |

---

## 4. Detailed File Tree

### API (`apps/api/src/`)

```
src/
├── main.ts                              # Bootstrap: CORS, global ValidationPipe, prefix /api/v1
├── app.module.ts                        # Root module — imports all 21 feature modules
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() — extracts AuthenticatedUser from request
│   │   └── public.decorator.ts         # @Public() — SetMetadata(IS_PUBLIC_KEY, true)
│   ├── guards/
│   │   └── clerk.guard.ts              # ClerkGuard — validates Clerk JWT, checks IS_PUBLIC_KEY
│   └── types/
│       └── auth.types.ts               # AuthenticatedUser { id, clerkId, companyId, role, ... }
└── modules/
    ├── auth/                            # Clerk webhooks, role guards, AuthModule
    ├── companies/                       # Company CRUD, tenantConfig management
    ├── users/                           # User management, role assignment
    ├── prisma/
    │   ├── prisma.service.ts            # PrismaClient singleton (onModuleInit / onModuleDestroy)
    │   └── prisma.module.ts             # @Global() PrismaModule
    ├── storage/                         # File storage abstraction (local disk / S3-compatible)
    ├── invoices/
    │   ├── dto/
    │   │   ├── create-invoice.dto.ts    # customerName, amount, dueDate, currency?
    │   │   ├── list-invoices.dto.ts     # page, limit, status, search
    │   │   └── update-invoice-status.dto.ts  # status: InvoiceStatus
    │   ├── invoices.controller.ts
    │   ├── invoices.service.ts          # Triggers WhatsApp payment_ack when PAID
    │   └── invoices.module.ts           # Imports WhatsAppModule
    ├── inventory/                       # SKU management, low-stock alerts
    ├── collections/
    │   ├── dto/
    │   │   └── list-collections.dto.ts  # page, limit, status, riskLevel, search
    │   ├── collections.controller.ts
    │   ├── collections.service.ts       # Risk scoring with ConfigService-driven weights/thresholds
    │   └── collections.module.ts        # Imports WhatsAppModule
    ├── dashboard/
    │   ├── dashboard.controller.ts
    │   ├── dashboard.service.ts         # ConfigService-driven insight thresholds
    │   └── dashboard.module.ts
    ├── filings/
    │   ├── filings.controller.ts        # GET /filings/calendar
    │   ├── filings.service.ts           # computeDeadline() + calendar aggregation
    │   └── filings.module.ts
    ├── documents/
    │   ├── dto/
    │   │   ├── upload-document.dto.ts       # documentType, notes?, requestId?, clientId?, filingPeriod?
    │   │   ├── list-documents.dto.ts        # page, limit, type, status
    │   │   └── create-document-request.dto.ts
    │   ├── documents.controller.ts
    │   ├── documents.service.ts          # MAX_FILE_SIZE_MB from ConfigService; Claude OCR; EmailService; extractFilingPeriod()
    │   └── documents.module.ts
    ├── upload-tokens/
    │   ├── dto/
    │   │   └── create-upload-token.dto.ts   # clientId?, label?, expiresInHours?
    │   ├── upload-tokens.controller.ts      # POST /upload-tokens; POST /public/upload/:token
    │   ├── upload-tokens.service.ts         # createToken(), resolveToken(), uploadWithToken()
    │   └── upload-tokens.module.ts
    ├── email/
    │   ├── email.service.ts             # Resend wrapper — sendDocumentUploaded, sendOcrComplete, sendDeadlineReminder
    │   └── email.module.ts              # @Global() — injectable everywhere
    ├── reports/                         # Report generation, background polling
    ├── whatsapp/
    │   ├── dto/
    │   │   ├── send-message.dto.ts       # type: SendMessageType enum
    │   │   └── list-messages.dto.ts      # page, limit, direction, status
    │   ├── whatsapp.controller.ts
    │   ├── whatsapp.service.ts           # Template rendering + Twilio API + quiet hours; handles inbound (templateKey: 'inbound')
    │   ├── template.service.ts           # Template CRUD
    │   └── whatsapp.module.ts            # Exports WhatsAppService + TemplateService
    ├── ai-assistant/
    │   ├── dto/
    │   │   ├── chat-message.dto.ts       # message (1–4000 chars), conversationId?
    │   │   └── create-knowledge.dto.ts   # title, content, category
    │   ├── embedding.service.ts          # OpenAI text-embedding-3-small (1536 dims)
    │   ├── knowledge.service.ts          # Chunk (800 chars, 100 overlap) + pgvector store
    │   ├── assistant.service.ts          # RAG pipeline + conversation history + citations
    │   ├── assistant.controller.ts
    │   └── ai-assistant.module.ts
    ├── clients/
    │   ├── dto/
    │   │   ├── create-client.dto.ts      # GSTIN/PAN @Matches() validators, serviceScope
    │   │   ├── update-client.dto.ts      # Partial of CreateClientDto
    │   │   └── list-clients.dto.ts       # page, limit, search
    │   ├── clients.controller.ts
    │   ├── clients.service.ts            # CRUD + importFromCsv() + getStats()
    │   └── clients.module.ts
    ├── settings/
    │   ├── dto/
    │   │   └── update-firm-profile.dto.ts  # name, gstNumber, panNumber, address, phone, website
    │   ├── settings.controller.ts
    │   ├── settings.service.ts           # Firm profile, config proxy, team management
    │   └── settings.module.ts
    ├── admin/
    │   ├── admin.guard.ts               # AdminGuard: validates x-admin-secret; onModuleInit validates ADMIN_SECRET length
    │   ├── admin.controller.ts          # @Public() @UseGuards(AdminGuard) — 20 routes
    │   ├── admin.service.ts             # Full tenant CRUD, CSV import, config, knowledge, impersonation, audit
    │   └── admin.module.ts
    └── config/
        ├── config-key.enum.ts            # 37 ConfigKey string enum values
        ├── config.service.ts             # get/getNum/getBool/getAll/set/reset
        ├── config.controller.ts          # GET/PATCH/DELETE /config/:key
        ├── config.seed.ts                # SYSTEM_CONFIG_ROWS array + seedSystemConfig()
        └── config.module.ts              # @Global() — injectable everywhere without import
```

### Frontend (`apps/web/src/`)

```
src/
├── middleware.ts                        # Clerk auth guard; public routes: /impersonate(.*)
├── lib/
│   ├── api-client.ts                   # Server-side fetch with Clerk token
│   ├── client-api.ts                   # useApiClient() hook for client components
│   └── utils.ts                        # cn() Tailwind merge helper
├── app/
│   ├── layout.tsx                      # Root layout — <ClerkProvider>
│   ├── page.tsx                        # Landing → redirect /dashboard
│   ├── onboarding/
│   │   └── page.tsx                    # 5-step onboarding wizard
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── impersonate/
│   │   └── page.tsx                    # Server component — verifies token, sets impersonation cookie, redirects
│   ├── upload/
│   │   └── [token]/page.tsx            # Public magic-link upload page (no auth required)
│   ├── dev/                            # Dev-only debug pages
│   └── (dashboard)/
│       ├── layout.tsx                  # Sidebar nav (persona-filtered) + Clerk auth guard + ImpersonationBanner
│       ├── dashboard/page.tsx          # KPIs, insights, critical customers
│       ├── collections/page.tsx        # Aging chart, invoice table, risk badges
│       ├── filings/page.tsx            # GST Filing Calendar — deadline table, FILED/PENDING/OVERDUE
│       ├── documents/page.tsx          # Upload, OCR results, document requests
│       ├── whatsapp/page.tsx           # Messages, templates, stats, bulk nudge
│       ├── reporting/page.tsx          # Report generation + status polling
│       ├── assistant/page.tsx          # RAG chat + knowledge manager
│       ├── inventory/page.tsx          # Inventory listing
│       └── settings/
│           ├── layout.tsx              # Left sidebar: 4 nav links
│           ├── page.tsx                # Redirect → /settings/profile
│           ├── profile/page.tsx
│           ├── clients/page.tsx
│           ├── team/page.tsx
│           └── rules/page.tsx
└── components/
    ├── ImpersonationBanner.tsx          # 'use client' — reads impersonation_session cookie; orange banner + End session
    ├── dashboard/
    │   ├── MetricCard.tsx
    │   ├── CriticalCustomersTable.tsx
    │   ├── InsightFeed.tsx
    │   └── LowStockWidget.tsx
    ├── collections/
    │   ├── CollectionsClient.tsx
    │   ├── InvoiceTable.tsx
    │   ├── CollectionsFilters.tsx
    │   ├── AgingChart.tsx
    │   └── InvoiceDrawer.tsx
    ├── documents/
    │   ├── DocumentsClient.tsx
    │   ├── DocumentList.tsx
    │   ├── DocumentUploadButton.tsx
    │   ├── DocumentDrawer.tsx
    │   └── RequestModal.tsx
    ├── whatsapp/
    │   └── WhatsAppClient.tsx
    ├── assistant/
    │   └── AssistantClient.tsx
    ├── reporting/
    │   └── ReportingClient.tsx
    ├── settings/
    │   ├── ProfileForm.tsx
    │   ├── ClientsManager.tsx
    │   ├── TeamManager.tsx
    │   └── BusinessRules.tsx
    ├── onboarding/
    │   └── OnboardingWizard.tsx
    └── ui/
        └── skeleton.tsx
```

### Admin Panel (`apps/admin/src/`)

```
src/
├── middleware.ts                        # Cookie-based auth: check admin_session on every request
├── lib/
│   └── admin-api.ts                    # Typed API client for all /api/v1/admin/* endpoints
├── app/
│   ├── layout.tsx                      # Root layout
│   ├── api/
│   │   └── auth/
│   │       └── route.ts               # POST: set admin_session cookie; DELETE: clear cookie
│   ├── login/
│   │   └── page.tsx                   # Password form → POST /api/auth
│   └── (admin)/
│       ├── layout.tsx                 # Admin shell: sidebar + header
│       ├── page.tsx                   # Platform stats dashboard + tenant list + audit log
│       └── tenants/
│           └── [id]/page.tsx          # Tenant detail — 5 tabs
└── components/
    └── TenantDetail.tsx               # 5-tab component: overview, clients, config, knowledge, activity
```

### Database Package (`packages/database/`)

```
packages/database/
├── prisma/
│   ├── schema.prisma                   # Full schema: 27+ models, 19 enums
│   └── seed.ts                         # 3 companies × full demo data + 37 SystemConfig rows
└── src/
    └── index.ts                        # Re-exports PrismaClient + all types/enums
```

---

## 5. Database Schema

### Enums

| Enum | Values |
|------|--------|
| `Industry` | `CA_FIRM`, `DISTRIBUTOR`, `MANUFACTURER` |
| `SubscriptionPlan` | `STARTER`, `GROWTH`, `ENTERPRISE` |
| `UserRole` | `ADMIN`, `OPERATIONS_MANAGER`, `STAFF` |
| `InvoiceStatus` | `PENDING`, `OVERDUE`, `PAID`, `PARTIAL` |
| `AIModule` | `DASHBOARD`, `COLLECTIONS`, `INVENTORY`, `WHATSAPP`, `REPORTING` |
| `InsightSeverity` | `INFO`, `WARNING`, `CRITICAL` |
| `DocumentType` | `INVOICE`, `PURCHASE_ORDER`, `DELIVERY_NOTE`, `GST_RETURN`, `TDS_CERTIFICATE`, `BANK_STATEMENT`, `FORM_16`, `OTHER` |
| `DocumentStatus` | `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`, `NEEDS_REVIEW` |
| `RequestStatus` | `PENDING`, `FULFILLED`, `CANCELLED` |
| `ReportType` | `COLLECTIONS_AGING`, `RECEIVABLES_SUMMARY`, `INVENTORY_STATUS`, `CASH_FLOW`, `AI_INSIGHTS_DIGEST` |
| `ReportStatus` | `PENDING`, `GENERATING`, `COMPLETED`, `FAILED` |
| `MessageDirection` | `OUTBOUND`, `INBOUND` |
| `MessageStatus` | `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `READ` |
| `KnowledgeCategory` | `GST_WORKFLOW`, `TDS_WORKFLOW`, `CLIENT_ONBOARDING`, `FILING_CHECKLIST`, `COMPANY_POLICY`, `GENERAL` |
| `MessageRole` | `USER`, `ASSISTANT` |
| `FilerType` | `MONTHLY`, `QUARTERLY`, `ANNUAL` |
| `FilingCategory` | `REGULAR`, `COMPOSITION`, `EXEMPT` |
| `ConfigDataType` | `NUMBER`, `BOOLEAN`, `STRING`, `JSON` |
| `ConfigCategory` | `COLLECTIONS`, `AI_INSIGHTS`, `GST_COMPLIANCE`, `DOCUMENTS`, `REPORTS`, `WHATSAPP` |

### Tables

#### `companies`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | Primary key |
| `name` | String | |
| `industry` | Industry | CA_FIRM / DISTRIBUTOR / MANUFACTURER |
| `subscriptionPlan` | SubscriptionPlan | |
| `tenantConfig` | JSON | `{ modulesEnabled[], aiPersona, featureFlags }` |
| `isActive` | Boolean | Default `true`. Admin can deactivate tenants. |
| `logoUrl` | String? | |
| `gstNumber` | String? | 15-char GSTIN |
| `panNumber` | String? | 10-char PAN |
| `address` | String? | |
| `website` | String? | |
| `phone` | String? | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

#### `users`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `clerkId` | String | Unique — from Clerk |
| `companyId` | String | FK → companies |
| `role` | UserRole | |
| `name` | String | |
| `email` | String | |
| `createdAt` | DateTime | |

#### `upload_tokens`

Magic-link tokens that let clients upload documents without a Clerk account.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `token` | String | Unique, 48-char hex (randomBytes(24)) |
| `companyId` | String | FK → companies |
| `clientId` | String? | FK → clients (optional — scopes upload to client) |
| `label` | String? | Description shown on upload page |
| `expiresAt` | DateTime | |
| `usedAt` | DateTime? | Set on first use (but does not block further uploads) |
| `createdAt` | DateTime | |

#### `impersonation_tokens`

Short-lived admin tokens for tenant impersonation from the admin panel.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `token` | String | Unique, 64-char hex (randomBytes(32)) |
| `companyId` | String | FK → companies (which tenant to impersonate) |
| `createdBy` | String | Default `"admin_panel"` |
| `expiresAt` | DateTime | 30 minutes from creation |
| `usedAt` | DateTime? | Set on verify — single-use |
| `createdAt` | DateTime | |

#### `invoices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | FK → companies |
| `customerName` | String | |
| `customerPhone` | String? | For WhatsApp reminders |
| `clientId` | String? | FK → clients (nullable) |
| `amount` | Decimal(14,2) | |
| `currency` | String | Default `INR` |
| `dueDate` | DateTime | |
| `paidAt` | DateTime? | Set when status → PAID |
| `status` | InvoiceStatus | |
| `agingDays` | Int | Days past due date |
| `createdAt` | DateTime | |

#### `collection_risks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `invoiceId` | String | Unique FK → invoices |
| `riskScore` | Float | 0.0–1.0 |
| `predictedDelayDays` | Int | |
| `riskFactors` | JSON | `{ factors: string[], weights: number[] }` |
| `calculatedAt` | DateTime | |

#### `inventory_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `sku` | String | Unique with `companyId` |
| `name` | String | |
| `category` | String | |
| `quantity` | Int | Current stock |
| `reorderLevel` | Int | Alert threshold |
| `unitCost` | Decimal(14,2) | |
| `movementVelocity` | Float | Units/day rolling average |
| `lastMovementAt` | DateTime? | |

#### `ai_insights`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `module` | AIModule | |
| `category` | String | e.g. "collections", "compliance" |
| `severity` | InsightSeverity | INFO / WARNING / CRITICAL |
| `summary` | String | Human-readable text |
| `dataSnapshot` | JSON | Raw data used to generate insight |
| `createdAt` | DateTime | |

#### `clients`

GST/TDS compliance clients for CA firms.

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | FK → companies |
| `name` | String | |
| `gstin` | String? | Regex: `/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/` |
| `pan` | String? | Regex: `/^[A-Z]{5}[0-9]{4}[A-Z]$/` |
| `contactPerson` | String? | |
| `phone` | String? | |
| `email` | String? | |
| `address` | String? | |
| `filerType` | FilerType | MONTHLY / QUARTERLY / ANNUAL |
| `filingCategory` | FilingCategory | REGULAR / COMPOSITION / EXEMPT |
| `serviceScope` | String[] | e.g. `["GST_FILING","TDS","AUDIT"]` |
| `gstDeadlineDay` | Int? | Day of month (1–28); fallback to system `gst_deadline_day` config |
| `isActive` | Boolean | Default true |
| Unique | `[companyId, gstin]` | Prevents duplicate GSTIN per firm |

#### `documents`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `uploadedById` | String | FK → users |
| `clientId` | String? | FK → clients (nullable) |
| `documentType` | DocumentType | |
| `status` | DocumentStatus | UPLOADED → PROCESSING → PROCESSED |
| `originalName` | String | |
| `storageKey` | String | `{companyId}/{yyyy}/{mm}/{uuid}.{ext}` |
| `fileSizeBytes` | Int | |
| `mimeType` | String | |
| `extractedData` | JSON? | Claude OCR output; null until PROCESSED |
| `filingPeriod` | String? | e.g. `"Nov 2024"`, `"Q3 2024"`. Auto-extracted from OCR for GST_RETURN. |
| `notes` | String? | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

#### `document_requests`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `clientId` | String? | FK → clients (nullable) |
| `requestedById` | String | FK → users (who requested) |
| `requestedFromUserId` | String | FK → users (who should fulfill) |
| `documentType` | DocumentType | |
| `status` | RequestStatus | |
| `dueDate` | DateTime? | |
| `notes` | String? | |
| `fulfilledDocumentId` | String? | FK → documents (set on fulfill) |

#### `system_configs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `key` | String | Unique — maps to ConfigKey enum |
| `value` | String | Stored as string, parsed by `dataType` |
| `dataType` | ConfigDataType | NUMBER / BOOLEAN / STRING / JSON |
| `category` | ConfigCategory | |
| `label` | String | Human-readable name |
| `description` | String? | |
| `unit` | String? | e.g. "days", "INR", "%" |
| `minValue` | String? | Validation bound |
| `maxValue` | String? | Validation bound |

#### `client_configs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | FK → companies |
| `key` | String | Matches a ConfigKey |
| `value` | String | Override value |
| `updatedBy` | String? | FK → users |
| `updatedAt` | DateTime | |
| Unique | `[companyId, key]` | One override per key per company |

#### `whatsapp_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `clientId` | String? | FK → clients (nullable) |
| `direction` | MessageDirection | OUTBOUND / INBOUND |
| `toPhone` | String | |
| `fromPhone` | String | |
| `templateKey` | String | `'inbound'` for customer replies; template key for outbound |
| `body` | String | Rendered message body |
| `status` | MessageStatus | QUEUED → SENT → DELIVERED |
| `twilioSid` | String? | |
| `metadata` | JSON? | Extra context (invoiceId, etc.) |
| `sentAt` | DateTime? | |
| `deliveredAt` | DateTime? | Set via Twilio webhook |
| `failedAt` | DateTime? | |
| `errorMessage` | String? | |

#### `whatsapp_templates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `key` | String | Unique with companyId |
| `name` | String | |
| `body` | String | With `{{variable}}` placeholders |
| `variables` | JSON | Array of variable name strings |
| `isActive` | Boolean | |

#### `knowledge_documents`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `title` | String | |
| `category` | KnowledgeCategory | |
| `content` | String | Full text |
| `fileKey` | String? | |
| `isActive` | Boolean | |

#### `knowledge_chunks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `documentId` | String | FK → knowledge_documents |
| `companyId` | String | |
| `chunkIndex` | Int | Order within document |
| `content` | String | ~800 chars with 100-char overlap |
| `embedding` | `vector(1536)` | pgvector column — cosine similarity search |

#### `assistant_conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `userId` | String | FK → users |
| `title` | String? | Auto-generated from first message |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

#### `assistant_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `conversationId` | String | FK → assistant_conversations |
| `role` | MessageRole | USER / ASSISTANT |
| `content` | String | |
| `citations` | JSON? | `[{ title, chunkIndex, score }]` |

#### `audit_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `userId` | String | FK → users |
| `action` | String | e.g. `invoice.status.updated`, `tenant.created` |
| `entity` | String | Table name |
| `entityId` | String | Row ID |
| `metadata` | JSON | Before/after state snapshot |
| `createdAt` | DateTime | |

#### `business_configs` (legacy)

Per-company runtime thresholds — superseded by `ClientConfig`. Kept for backwards compatibility.

#### `reports`

| Column | Type | Notes |
|--------|------|-------|
| `id` | String CUID | |
| `companyId` | String | |
| `generatedById` | String | FK → users |
| `reportType` | ReportType | |
| `status` | ReportStatus | PENDING → GENERATING → COMPLETED |
| `format` | String | Default `JSON` |
| `fileKey` | String? | Storage path |
| `aiSummary` | String? | Claude-generated executive narrative |
| `dataSnapshot` | JSON? | Raw aggregated data |
| `periodStart` | DateTime? | |
| `periodEnd` | DateTime? | |

---

## 6. API Reference

**Base URL:** `http://localhost:3001/api/v1`

All endpoints except those listed as **Public** require:
```
Authorization: Bearer <clerk_token>
```

Admin endpoints require (instead of Bearer):
```
x-admin-secret: <ADMIN_SECRET>
```

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/webhook` | Public (svix sig) | Clerk webhook — provisions Company + User on sign-up |

### Collections

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/collections` | Required | Paginated list with risk scores |
| `GET` | `/collections/aging` | Required | Aging bucket breakdown |
| `GET` | `/collections/:id` | Required | Single invoice + CollectionRisk |
| `POST` | `/collections/:id/remind` | ADMIN/OPS_MGR | Send WhatsApp reminder |
| `POST` | `/collections/risk/calculate` | ADMIN/OPS_MGR | Trigger background risk recalculation |

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/dashboard/summary` | Required | KPIs: receivables total, aging buckets, low stock, critical customers |
| `GET` | `/dashboard/insights` | Required | AI-generated insights sorted by severity |
| `POST` | `/dashboard/insights/refresh` | Required | Fire-and-forget async Claude insight generation |

### Invoices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/invoices` | Required | Paginated list |
| `GET` | `/invoices/aging-summary` | Required | Bucket counts and amounts |
| `GET` | `/invoices/:id` | Required | Invoice + CollectionRisk |
| `POST` | `/invoices` | ADMIN/OPS_MGR | Create invoice |
| `PATCH` | `/invoices/:id/status` | ADMIN/OPS_MGR | Update status; triggers WhatsApp payment_ack on PAID |

### Inventory

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/inventory` | Required | Paginated SKU list |
| `GET` | `/inventory/low-stock` | Required | Items at/below reorder level |
| `GET` | `/inventory/:id` | Required | Single item |
| `POST` | `/inventory` | ADMIN/OPS_MGR | Create item |
| `PATCH` | `/inventory/:id` | ADMIN/OPS_MGR | Update quantity / velocity |

### GST Filings Calendar

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/filings/calendar` | Required | Deadline table for all active clients |

**`GET /filings/calendar` response:**
```jsonc
[
  {
    "clientId": "clx...",
    "clientName": "Sharma Textiles Pvt Ltd",
    "filerType": "MONTHLY",
    "deadline": "2025-01-20T00:00:00.000Z",
    "period": "Dec 2024",
    "daysRemaining": 3,
    "status": "PENDING",   // FILED | PENDING | OVERDUE
    "documentId": null     // set when a matching GST_RETURN doc is found
  },
  {
    "clientId": "clx...",
    "clientName": "Gupta Brothers Trading",
    "filerType": "QUARTERLY",
    "deadline": "2024-11-30T00:00:00.000Z",
    "period": "Oct 2024",
    "daysRemaining": -8,
    "status": "OVERDUE",
    "documentId": null
  }
]
```

### Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/documents` | ADMIN/OPS_MGR | `multipart/form-data`: `file` + `documentType` + `notes?` + `requestId?` + `clientId?` + `filingPeriod?` |
| `GET` | `/documents` | Required | Paginated. Includes `filingPeriod`, `client` in response |
| `GET` | `/documents/requests` | Required | List document requests |
| `POST` | `/documents/requests` | Required | Create document request |
| `GET` | `/documents/file/:key(*)` | Required | Stream file from storage |
| `GET` | `/documents/:id` | Required | Document detail + extracted OCR data |
| `PATCH` | `/documents/:id/filing-period` | Required | `{ "filingPeriod": "Nov 2024" }` — manual override |
| `DELETE` | `/documents/:id` | ADMIN | Delete document |
| `POST` | `/documents/:id/reprocess` | ADMIN/OPS_MGR | Re-trigger Claude OCR |
| `POST` | `/documents/requests/:id/fulfill` | ADMIN/OPS_MGR | `{ "documentId": "..." }` |

### Upload Tokens (Client Magic Links)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/upload-tokens` | Required | Create magic-link token. Body: `{ clientId?, label?, expiresInHours? }` |
| `GET` | `/upload-tokens` | Required | List all tokens for company |
| `DELETE` | `/upload-tokens/:id` | Required | Revoke a token (sets expiresAt to now) |
| `POST` | `/public/upload/:token` | **Public** | `multipart/form-data`: `file` + `documentType`. No Clerk auth. |

**`POST /upload-tokens` response:**
```jsonc
{
  "id": "clx...",
  "token": "a1b2c3d4...",
  "uploadUrl": "https://app.opscopilot.in/upload/a1b2c3d4...",
  "expiresAt": "2025-01-20T00:00:00.000Z"
}
```

### WhatsApp

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/whatsapp/stats` | Required | Message counts |
| `GET` | `/whatsapp/messages` | Required | Paginated message log (includes inbound) |
| `POST` | `/whatsapp/send` | Required | `{ type, invoiceId?, documentRequestId? }` |
| `POST` | `/whatsapp/invoices/:id/remind` | Required | Fee reminder for specific invoice |
| `POST` | `/whatsapp/invoices/:id/payment-ack` | Required | Payment acknowledgement |
| `POST` | `/whatsapp/deadline-nudge` | Required | Bulk GST deadline nudge |
| `GET` | `/whatsapp/templates` | Required | List company templates |
| `PUT` | `/whatsapp/templates/:key` | Required | Update template body |
| `POST` | `/whatsapp/webhook` | Public (Twilio sig) | Inbound messages + status callbacks |

### AI Assistant

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/assistant/chat` | Required | `{ message, conversationId? }` — RAG answer |
| `GET` | `/assistant/conversations` | Required | List conversations |
| `GET` | `/assistant/conversations/:id` | Required | Full conversation with messages |
| `DELETE` | `/assistant/conversations/:id` | Required | Delete conversation |
| `GET` | `/assistant/knowledge` | Required | List knowledge documents |
| `POST` | `/assistant/knowledge` | Required | Ingest doc: `{ title, content, category }` |
| `DELETE` | `/assistant/knowledge/:id` | Required | Delete knowledge document + chunks |
| `POST` | `/assistant/knowledge/:id/toggle` | Required | `?active=true/false` |
| `GET` | `/assistant/search` | Required | `?q=query` — semantic chunk search |

### Clients

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/clients` | Required | Paginated list |
| `POST` | `/clients` | Required | Create client |
| `GET` | `/clients/:id` | Required | Client detail |
| `GET` | `/clients/:id/stats` | Required | Invoice/document aggregates |
| `PATCH` | `/clients/:id` | Required | Update client |
| `DELETE` | `/clients/:id` | Required | Soft delete |
| `POST` | `/clients/import` | Required | `{ csv: "..." }` bulk import |

### Settings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/settings/profile` | Required | Company profile |
| `PATCH` | `/settings/profile` | Required | Update profile |
| `GET` | `/settings/config` | Required | All config keys merged |
| `PATCH` | `/settings/config/:key` | Required | Create/update ClientConfig override |
| `DELETE` | `/settings/config/:key` | Required | Remove override |
| `GET` | `/settings/team` | Required | All users in company |
| `PATCH` | `/settings/team/:userId/role` | Required | Change user role |

### Admin — Platform Management

All admin endpoints bypass Clerk auth (`@Public()`) and require `x-admin-secret` header via `AdminGuard`.

**Stats & Overview**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/stats` | Platform-wide counts: tenants, clients, documents, messages, AI calls, storage |
| `GET` | `/admin/audit` | Audit log. Query: `limit?`, `companyId?` |

**Tenant Management**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/tenants` | List all tenants with user/client/document counts |
| `POST` | `/admin/tenants` | Create tenant (Company + User + 4 WA templates + Clerk invite + audit log) |
| `GET` | `/admin/tenants/:id` | Full tenant detail: users, clients, overdue amount, WA stats |
| `PATCH` | `/admin/tenants/:id` | Update name, plan, GSTIN, PAN, phone, address, modulesEnabled |
| `DELETE` | `/admin/tenants/:id/deactivate` | Soft-deactivate tenant (sets `isActive = false`) |
| `POST` | `/admin/tenants/:id/clients/import` | `multipart/form-data`: CSV file; returns `{ created, updated, skipped, errors[] }` |

**Per-Tenant Config**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/tenants/:id/config` | All config keys for tenant (system defaults + overrides merged) |
| `PATCH` | `/admin/tenants/:id/config/:key` | `{ value }` — create/update tenant config override |
| `DELETE` | `/admin/tenants/:id/config/:key` | Reset key to system default |

**Per-Tenant Knowledge Base**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/tenants/:id/knowledge` | List knowledge documents |
| `POST` | `/admin/tenants/:id/knowledge` | `{ title, category, content }` — index and embed |
| `DELETE` | `/admin/tenants/:id/knowledge/:docId` | Delete document + chunks |

**System Config**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/system-config` | All 37 platform-wide ConfigKey defaults |
| `PATCH` | `/admin/system-config/:key` | `{ value }` — update platform default |

**Impersonation**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/tenants/:id/impersonate` | Create impersonation token (30 min TTL, single-use) |
| `POST` | `/admin/impersonate/verify` | Verify token → returns `{ token, url }` (called by apps/web /impersonate page) |

---

## 7. Business Logic & Flow Diagrams

### GST Filing Calendar

```
GET /filings/calendar

For each active client in company:

  1. computeDeadline(client.filerType, client.gstDeadlineDay, today):

     MONTHLY:
       deadline = {current month's gstDeadlineDay}
       if today > deadline → advance to next month
       period = "MMM YYYY" of month before deadline month

     QUARTERLY:
       deadline months: [3, 6, 9, 0]  (Apr/Jul/Oct/Jan)
       iterate until next deadline month is found
       period = last full quarter month (e.g. "Oct 2024" for Jan deadline)

  2. daysRemaining = deadline - today  (can be negative)

  3. status lookup:
     find Document WHERE companyId = x
                    AND clientId = client.id
                    AND documentType = 'GST_RETURN'
                    AND filingPeriod = period

     → doc found?           status = FILED
     → daysRemaining < 0?   status = OVERDUE
     → else                 status = PENDING

  4. Sort: OVERDUE first, then by daysRemaining asc
```

### Filing Period Auto-Extraction (OCR)

```
On OCR complete for a GST_RETURN document:

  Look for filingPeriod in these extractedData fields (in priority order):
    period, filing_period, month, tax_period, return_period

  Regex patterns tried:
    monthFull:  "November 2024", "NOVEMBER 2024"
    monthShort: "Nov 2024", "NOV 2024"
    slashFmt:   "11/2024"
    dashFmt:    "2024-11"

  On match → normalize to "Nov 2024" format
  → UPDATE document SET filingPeriod = "Nov 2024"

  PATCH /documents/:id/filing-period
  → Manual override for cases where OCR did not extract it
```

### Collections Risk Scoring

```
Trigger: POST /collections/risk/calculate

For each PENDING/OVERDUE invoice in company:

  agingScore    = min(agingDays / AGING_BUCKET_3_MAX, 1.0)
  amountScore   = invoice.amount / max(amount in company dataset)
  historyScore  = (late invoices / total past invoices) for this customer

  riskScore = agingScore   × RISK_WEIGHT_AGING   (default 0.5)
            + amountScore  × RISK_WEIGHT_AMOUNT  (default 0.3)
            + historyScore × RISK_WEIGHT_HISTORY (default 0.2)

  predictedDelayDays = agingDays × DELAY_MULTIPLIER

  riskScore >= RISK_THRESHOLD_HIGH   (0.7) → HIGH   (red)
  riskScore >= RISK_THRESHOLD_MEDIUM (0.3) → MEDIUM (amber)
  else                                     → LOW    (green)

  Upsert CollectionRisk row for invoice
```

### WhatsApp Reminder Auto-Send

```
POST /collections/:id/remind  OR  Invoice status → PAID

    ├─ Is whatsappEnabled in tenantConfig?  No → skip
    ├─ Does invoice have customerPhone?     No → skip
    ├─ Count sent messages ≥ WHATSAPP_MAX_PER_INVOICE?  Yes → skip
    ├─ Current hour in quiet hours window?  Yes → skip
    ├─ Render template with variables
    ├─ Call Twilio API → receive SID
    ├─ Insert WhatsAppMessage (status: QUEUED, twilioSid)
    └─ Return { messageId, status: "queued" }

Twilio inbound webhook → POST /whatsapp/webhook:
    → Insert WhatsAppMessage (direction: INBOUND, templateKey: 'inbound')
    → If MediaUrl0 present → route to DocumentsService for OCR
```

### Email Notifications (Resend)

```
EmailService — gracefully degrades if RESEND_API_KEY not set (logs warning, no throw)

sendDocumentUploaded(doc, client, uploaderEmail):
  Subject: "Document uploaded — {documentType} for {clientName}"
  Body: HTML table with client, type, filename, filingPeriod (if set)

sendOcrComplete(doc, client, recipientEmail):
  Subject: "✅ OCR complete — {filename}" (or ⚠️ NEEDS_REVIEW / ❌ FAILED)
  Body: extracted fields summary + link to document

sendDeadlineReminder(companyEmail, overdueClients, dueSoonClients):
  Subject: "GST deadline reminder — {N} clients need attention"
  Body: Two tables — OVERDUE (red) and DUE_SOON (amber) with client names + periods
```

### Document OCR Pipeline

```
POST /documents (multipart/form-data: file + documentType + clientId? + filingPeriod?)

    ├─ Validate: fileSizeBytes ≤ MAX_FILE_SIZE_MB × 1024 × 1024
    ├─ Validate MIME type (pdf, jpeg, png)
    ├─ storageKey = {companyId}/{yyyy}/{mm}/{uuid}.{ext}
    ├─ Write file to disk (or S3)
    ├─ Insert Document row (status: UPLOADED, clientId, filingPeriod)
    ├─ Email: notifyUpload() → sendDocumentUploaded()
    │
    └─ Async OCR (non-blocking):
        ├─ Read file bytes → base64
        ├─ Build Claude prompt for documentType
        ├─ Claude returns structured JSON
        ├─ For GST_RETURN: auto-extract filingPeriod if not already set
        ├─ status: PROCESSED / NEEDS_REVIEW / FAILED
        └─ Email: sendOcrComplete()
```

### AI Dashboard Insight Generation

```
POST /dashboard/insights/refresh  (returns 202, runs async)

    ├─ Gather KPI snapshot (overdue amounts, aging, trend, top customers)
    ├─ Build Claude prompt with severity rules
    ├─ Claude returns JSON array of insights
    ├─ Delete all existing insights for company
    └─ Insert new AIInsight rows
```

### RAG Chat (AI Assistant)

```
POST /assistant/chat { message, conversationId? }

  Step 1: Embed message → OpenAI text-embedding-3-small → float[1536]
  Step 2: Cosine search knowledge_chunks → top 5 by 1 - (embedding <=> query)
  Step 3: Build system prompt with retrieved context + "cite your sources"
  Step 4: Send to Claude with full conversation history
  Step 5: Parse response + extract citation references
  Step 6: Save USER + ASSISTANT messages to DB
  Step 7: Return { conversationId, message: { role, content, citations } }
```

### Onboarding Wizard Flow

```
User signs up via Clerk → CLERK_AFTER_SIGN_UP_URL=/onboarding

  Step 1 ── Firm Details
  Step 2 ── Enable Modules
  Step 3 ── Add Clients  [Skip]
  Step 4 ── WhatsApp Setup  [Skip]
  Step 5 ── Review
    [Go to Dashboard] → clears localStorage → /dashboard
```

### Impersonation Flow

```
Admin panel → Tenant detail → "Impersonate" button
    │
    ▼
POST /api/v1/admin/tenants/:id/impersonate (x-admin-secret)
    → Creates ImpersonationToken (64-char hex, 30min TTL, single-use)
    → Returns { token, url: "/impersonate?token=..." }

Admin opens URL in browser
    │
    ▼
GET /impersonate?token=XXX  (apps/web, public route)
    │  Server component — POSTs to /api/v1/admin/impersonate/verify
    │  Validates: not expired, not used (marks usedAt)
    │  On success → set cookie impersonation_session="{companyId}:{companyName}" (30min, client-readable)
    │  redirect('/dashboard')
    ▼
ImpersonationBanner (apps/web, 'use client')
    │  Reads cookie on every page
    │  Shows orange banner: "⚠ Admin view: {Firm Name}"
    │  "End session" button → clears cookie → router.refresh()
```

### ConfigService Resolution Order

```
ConfigService.get(companyId, key: ConfigKey)

  1. ClientConfig  (company-specific override)
  2. SystemConfig  (platform default)
  3. Hardcoded fallback (console.warn)
```

---

## 8. Frontend — Pages & Components

### Sidebar Navigation (Persona-Filtered)

The sidebar reads the company's `industry` field from `/api/v1/settings/profile` at layout render time. Nav items are filtered by the `modulesEnabled` array from `INDUSTRY_DEFAULTS[industry]` in `@opsc/types`.

```
┌──────────────────────────────┐
│  ● OpsCopilot                │
│  [CA / Tax Firm  badge]      │ ← persona badge (blue / amber / green)
├──────────────────────────────┤
│  Dashboard        (all)      │
│  GST Filings      (CA_FIRM)  │ ← not shown for Distributor/Manufacturer
│  Collections      (all)      │
│  Inventory        (DIST/MFG) │ ← not shown for CA_FIRM
│  Documents        (all)      │
│  Reports          (all)      │
│  WhatsApp         (all)      │
│  AI Assistant     (all)      │
│  Settings         (always)   │
└──────────────────────────────┘
```

Module visibility by persona:

| Module | CA_FIRM | DISTRIBUTOR | MANUFACTURER |
|--------|---------|-------------|--------------|
| Dashboard | ✓ | ✓ | ✓ |
| GST Filings | ✓ | — | — |
| Collections | ✓ | ✓ | ✓ |
| Inventory | — | ✓ | ✓ |
| Documents | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✓ |
| WhatsApp | ✓ | ✓ | ✓ |
| AI Assistant | ✓ | ✓ | ✓ |

### `/filings` — GST Filing Calendar

Server Component fetches `GET /filings/calendar`. Client component handles sorting/filtering.

| Column | Description |
|--------|-------------|
| Client name | Firm name with GSTIN badge |
| Filer type | MONTHLY / QUARTERLY chip |
| Period | e.g. "Dec 2024" |
| Deadline | Formatted date |
| Days remaining | Number (negative = overdue) |
| Status | FILED (green), PENDING (amber), OVERDUE (red) |
| Action | "View document" link if FILED; "Upload now" if PENDING/OVERDUE |

### `/upload/[token]` — Client Magic-Link Upload

Public page (no Clerk auth). Fetches token metadata to show client name and label. Drag-and-drop file upload posts to `/public/upload/:token`. Shows progress and success/error state.

### `/dashboard`

SSR KPIs + InsightFeed. Refresh button triggers insight regeneration.

### `/collections`

Client-side `CollectionsClient` — aging chart, invoice table with risk badges, `InvoiceDrawer` slide-in.

### `/documents`

Upload with `documentType`, `clientId`, optional `filingPeriod`. `DocumentDrawer` shows extracted OCR fields and `filingPeriod` tag. Links to filing calendar when applicable.

### `/whatsapp`

Three tabs: Overview (stats + bulk nudge), Messages (includes inbound), Templates (inline edit).

### `/assistant`

Chat panel + Knowledge panel. Citations shown as collapsible chips.

### `/settings`

Four tabs: Profile, Clients (CSV import + stats drawer), Team (inline role change), Business Rules (6-category config editor).

### `/impersonate`

Server component. Validates token, sets cookie, redirects. Shows error page on invalid/expired token.

### Admin Panel (`apps/admin`)

#### `/login`

Password field → POST `/api/auth` → sets `admin_session` httpOnly cookie (8 hr). Middleware redirects all non-public paths to `/login` if cookie absent.

#### `/` — Platform Overview

- Stats cards: total tenants, active tenants, total clients, documents, WA messages, storage
- Tenant table: name, industry badge, plan badge, user/client/document counts, active status, action buttons
- Recent audit log with companyName, userName, action, timestamp

#### `/tenants/[id]` — Tenant Detail (5 tabs)

**Overview:** Stats grid (users, clients, invoices, documents). Users table. Overdue amount. WA stats.

**Clients:** Full client list with import CSV button. Drag-and-drop CSV upload. Import result: `{ created, updated, skipped, errors[] }` with per-row error messages.

**Config:** All 37 config keys in a table. Per-row inline editor (click → input → Enter/blur to save). Reset button reverts to system default. `isOverridden` badge on overridden rows.

**Knowledge:** List of knowledge documents with chunk count. "Add document" form: title, category, content textarea. Delete button with confirmation.

**Activity:** Audit log for this tenant. "Export CSV" button downloads the log.

---

## 9. Configuration System

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ConfigService  (@Global)                   │
│                                                              │
│  get(companyId, key)  →  ClientConfig || SystemConfig        │
│  getNum(...)          →  number                              │
│  getBool(...)         →  boolean                             │
│  getAll(companyId)    →  ConfigSnapshot (all 37 keys merged) │
│  set(companyId, key, value, userId)  →  upsert ClientConfig  │
│  reset(companyId, key)               →  delete ClientConfig  │
└──────────────────────────────────────────────────────────────┘
```

### All ConfigKey Values

#### COLLECTIONS (12 keys)

| Key | Default | Unit |
|-----|---------|------|
| `aging_bucket_1_max` | 30 | days |
| `aging_bucket_2_max` | 60 | days |
| `aging_bucket_3_max` | 90 | days |
| `risk_weight_aging` | 0.5 | 0–1 |
| `risk_weight_amount` | 0.3 | 0–1 |
| `risk_weight_history` | 0.2 | 0–1 |
| `risk_threshold_high` | 0.7 | 0–1 |
| `risk_threshold_medium` | 0.3 | 0–1 |
| `reminder_interval_days` | 7 | days |
| `max_reminders_per_invoice` | 3 | count |
| `critical_customer_count` | 3 | count |
| `delay_multiplier` | 1.0 | multiplier |

#### AI_INSIGHTS (5 keys)

| Key | Default | Unit |
|-----|---------|------|
| `insight_critical_overdue_amount` | 100000 | INR |
| `insight_warning_overdue_count` | 5 | count |
| `insight_warning_trend_percent` | -10 | % |
| `insight_trend_window_days` | 7 | days |
| `max_insights_per_refresh` | 5 | count |

#### GST_COMPLIANCE (4 keys)

| Key | Default | Unit |
|-----|---------|------|
| `gst_deadline_day` | 20 | day of month |
| `gst_deadline_urgency_days` | 10 | days |
| `quarterly_deadline_months` | [4,7,10,1] | JSON array |
| `late_fee_rate_per_day` | 50 | INR/day |

#### DOCUMENTS (5 keys)

| Key | Default | Unit |
|-----|---------|------|
| `max_file_size_mb` | 10 | MB |
| `confidence_threshold_green` | 0.8 | 0–1 |
| `confidence_threshold_amber` | 0.6 | 0–1 |
| `auto_reject_below_confidence` | null | 0–1 |
| `ocr_poll_interval_seconds` | 3 | seconds |

#### REPORTS (6 keys)

| Key | Default |
|-----|---------|
| `default_report_period` | "current_month" |
| `report_poll_interval_seconds` | 5 |
| `report_timeout_seconds` | 30 |
| `auto_report_enabled` | false |
| `auto_report_day_of_month` | 1 |
| `auto_report_recipients` | [] |

#### WHATSAPP (5 keys)

| Key | Default | Unit |
|-----|---------|------|
| `whatsapp_max_per_minute` | 10 | messages/min |
| `whatsapp_nudge_window_days` | 7 | days |
| `whatsapp_quiet_hours_start` | 22 | hour |
| `whatsapp_quiet_hours_end` | 8 | hour |
| `whatsapp_max_per_invoice` | 3 | count |

---

## 10. AI & Integrations

### Claude (Anthropic) — `claude-sonnet-4-6`

Three use cases: Document OCR, Dashboard Insight Generation, RAG Chat. See §7 for flow diagrams.

### OpenAI Embeddings — `text-embedding-3-small`

1536-dimensional vectors. Zero-vector fallback when `OPENAI_API_KEY` is not set (dev mode). Stored in `knowledge_chunks.embedding` as pgvector `vector(1536)`.

### Twilio WhatsApp

Outbound + inbound. Default 4 templates per company. Webhook validates `X-Twilio-Signature`. Inbound messages with `MediaUrl0` are routed to Documents OCR pipeline.

**Default templates:**

| Template key | Variables |
|-------------|-----------|
| `fee_reminder` | `customerName`, `amount`, `dueDate`, `agingDays`, `companyName` |
| `document_request` | `recipientName`, `documentType`, `dueDate`, `companyName` |
| `gst_deadline_nudge` | `clientName`, `deadline`, `companyName` |
| `payment_ack` | `customerName`, `amount`, `invoiceId`, `companyName` |

### Resend (Transactional Email)

Sends HTML emails for: document uploaded, OCR complete (with status emoji), GST deadline reminders (overdue + due-soon tables). Gracefully disabled if `RESEND_API_KEY` not set — logs warning, no throw.

### Clerk Authentication (web app only)

Sign-up → `/onboarding` → webhook creates Company + User. Sign-in → Clerk JWT → `ClerkGuard` validates + injects `@CurrentUser()`. Public routes bypass Clerk. Admin routes bypass Clerk entirely (use `AdminGuard` instead).

---

## 11. Environment Variables

Copy `.env.example` to `.env`. All apps read from the root `.env` file.

```bash
# ── Database ────────────────────────────────────────────────────────
POSTGRES_USER=opsc
POSTGRES_PASSWORD=opsc_secret
POSTGRES_DB=opsc_copilot
DATABASE_URL="postgresql://opsc:opsc_secret@localhost:5433/opsc_copilot?schema=public"

# ── Redis ────────────────────────────────────────────────────────────
REDIS_PASSWORD=redis_secret
REDIS_URL="redis://:redis_secret@localhost:6379"

# ── Clerk Auth (apps/web only) ───────────────────────────────────────
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# ── API ──────────────────────────────────────────────────────────────
API_PORT=3001
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── Admin Panel ──────────────────────────────────────────────────────
ADMIN_SECRET=your_secret_here_must_be_32_chars_minimum
NEXT_PUBLIC_ADMIN_API_URL=http://localhost:3001   # used by apps/admin
ADMIN_API_URL=http://localhost:3001               # server-side fallback

# ── Anthropic Claude ─────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

# ── OpenAI Embeddings (optional — zero-vector fallback in dev) ───────
OPENAI_API_KEY=sk-...

# ── Twilio WhatsApp (optional — WhatsApp disabled if absent) ─────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# ── Resend Email (optional — email notifications disabled if absent) ──
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@opscopilot.in

# ── App ──────────────────────────────────────────────────────────────
NODE_ENV=development
LOG_LEVEL=debug
```

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | |
| `REDIS_URL` | Yes | |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | |
| `CLERK_SECRET_KEY` | Yes | |
| `CLERK_WEBHOOK_SECRET` | Yes | User provisioning |
| `ANTHROPIC_API_KEY` | Yes | OCR + insights + chat |
| `ADMIN_SECRET` | Yes | Must be ≥ 32 chars. API crashes on start if too short. |
| `ANTHROPIC_MODEL` | No | Default: `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | No | Zero-vector embeddings if absent |
| `TWILIO_*` | No | WhatsApp send disabled if absent |
| `RESEND_API_KEY` | No | Email notifications disabled if absent |
| `EMAIL_FROM` | No | Default: `noreply@opscopilot.in` |
| `NEXT_PUBLIC_ADMIN_API_URL` | No (admin app) | Default: `http://localhost:3001` |

---

## 12. Local Development Setup

### Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@9.4.0 --activate`)
- Docker Desktop

### Steps

```bash
# 1. Clone and install dependencies
git clone https://github.com/your-org/opsc-copilot
cd opsc-copilot
pnpm install

# 2. Start PostgreSQL (with pgvector) and Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env — fill in Clerk, Anthropic, ADMIN_SECRET (≥32 chars),
#             and optionally Twilio/OpenAI/Resend

# 4. Database setup
pnpm db:generate                              # Generate Prisma client
pnpm --filter @opsc/database db:push         # Push schema (no migration file)
pnpm db:seed                                  # Seed demo companies + SystemConfig

# 5. Start all services
pnpm dev
# → API:    http://localhost:3001/api/v1
# → Web:    http://localhost:3000
# → Admin:  http://localhost:3002  (password = ADMIN_SECRET)

# Sign up → automatically routes to /onboarding
```

### Running Apps Individually

```bash
pnpm --filter @opsc/api dev       # API only (port 3001)
pnpm --filter @opsc/web dev       # Web only (port 3000)
pnpm --filter @opsc/admin dev     # Admin panel only (port 3002)
```

### Build Check

```bash
pnpm build          # Full production build (all 6 packages)
pnpm type-check     # TypeScript tsc --noEmit across all packages
```

### Docker Services

| Service | Image | Host Port | Purpose |
|---------|-------|-----------|---------|
| `opsc_postgres` | `pgvector/pgvector:pg16` | `5433` | PostgreSQL with vector extension |
| `opsc_redis` | `redis:7-alpine` | `6379` | Cache + rate limiting |

---

## 13. Seed Data

Run `pnpm db:seed` to populate the database. The script drops and recreates all demo data.

### Company 1 — Mehta & Associates CA

**Industry:** CA_FIRM | **Plan:** GROWTH

| Entity | Details |
|--------|---------|
| Users | 3: Rahul (ADMIN), Neha (OPS_MGR), Suresh (STAFF) |
| Clients | 5 (with GSTINs, PANs, filer types — MONTHLY/QUARTERLY) |
| Invoices | 20 (mixed PENDING/OVERDUE/PAID/PARTIAL) |
| Collection Risks | Computed for all PENDING/OVERDUE invoices |
| Documents | 2 (1 PROCESSED invoice, 1 NEEDS_REVIEW GST_RETURN with filingPeriod) |
| Reports | 2 (1 COMPLETED, 1 FAILED) |
| WhatsApp templates | 4 (fee_reminder, document_request, gst_deadline_nudge, payment_ack) |
| WhatsApp messages | 4 outbound + 1 inbound |
| Knowledge docs | 3 (GST SOP, TDS SOP, Onboarding Checklist) with vector chunks |
| ClientConfig overrides | `gst_deadline_day` → 18, `insight_critical_overdue_amount` → 75000 |

### Company 2 — Sharma Distributors Pvt Ltd

**Industry:** DISTRIBUTOR | **Plan:** STARTER

20 invoices with wholesale FMCG amounts. 10 FMCG SKUs. Inventory-focused AI insights. No GST Filings module in sidebar.

### Company 3 — Krishna Auto Parts Mfg

**Industry:** MANUFACTURER | **Plan:** ENTERPRISE

20 invoices from auto service shops. 10 auto parts SKUs. Manufacturer-focused insights. No GST Filings module.

### SystemConfig (37 rows)

All 37 keys across 6 categories with labels, descriptions, units, min/max.

---

## 14. Scripts Reference

### Root-level (via Turborepo)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + Web + Admin in watch mode |
| `pnpm build` | Production build of all 6 packages |
| `pnpm lint` | ESLint all packages |
| `pnpm type-check` | `tsc --noEmit` across all packages |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:migrate` | `prisma migrate dev` — create and apply migration |
| `pnpm db:migrate:deploy` | `prisma migrate deploy` — run migrations in production |
| `pnpm db:studio` | Prisma Studio at `http://localhost:5555` |
| `pnpm db:seed` | Run seed script (drops + recreates all demo data) |

### Docker

```bash
docker compose up -d        # Start Postgres + Redis
docker compose down         # Stop services (data preserved)
docker compose down -v      # Stop + delete volumes (wipes DB)
docker compose logs -f      # Follow logs
```

---

## 14b. Production Database — Neon

**Decision:** Production uses [Neon](https://neon.tech) managed Postgres instead of a self-hosted container.

**Why Neon:**
- Automated daily snapshots + 7-day point-in-time recovery (free tier)
- Native pgvector support (required for AI embeddings)
- Serverless-compatible connection pooling via PgBouncer
- Zero-maintenance — no backup scripts, no volume management
- Free tier covers early-stage usage (0.5 GB, 1 project)

**Local vs Production:**
| Environment | Database | Notes |
|-------------|----------|-------|
| Local dev | Docker (`pgvector/pgvector:pg16`, port 5433) | `docker compose up -d` |
| Production (Railway) | Neon managed Postgres | `DATABASE_URL` set in Railway env vars |

### Setting up Neon (one-time)

```bash
# 1. Create account at https://neon.tech (free)
# 2. Create a new project — select "PostgreSQL 16", region "Asia Pacific (Mumbai)"
# 3. Enable pgvector extension in Neon SQL editor:
CREATE EXTENSION IF NOT EXISTS vector;

# 4. Copy the connection string from Neon dashboard
#    Format: postgresql://user:password@host/dbname?sslmode=require

# 5. Set in Railway environment variables:
DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require

# 6. Run Prisma migrations against Neon:
DATABASE_URL="<neon-url>" pnpm --filter @opsc/database db:push

# 7. Seed initial data (optional — for staging):
DATABASE_URL="<neon-url>" pnpm db:seed
```

### Restoring from a backup (Neon point-in-time recovery)

1. Go to [Neon Console](https://console.neon.tech) → Your project → **Branches**
2. Click **Restore** on the `main` branch
3. Select the timestamp to restore to (up to 7 days back)
4. Neon creates a new branch at that point — verify data, then promote to main

### Connection string format

```
# Local (Docker)
DATABASE_URL="postgresql://opsc:opsc_secret@localhost:5433/opsc_copilot?schema=public"

# Production (Neon) — note sslmode=require
DATABASE_URL="postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require&schema=public"
```

> **Note:** Neon requires `sslmode=require`. The `?schema=public` suffix is for Prisma's schema inference — keep it.

---

## 15. Project Status

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Auth (Clerk), Companies, Users, Invoices, Inventory, basic Dashboard | ✅ Complete |
| **Phase 2** | Collections risk scoring, aging breakdown, Document OCR (Claude) | ✅ Complete |
| **Phase 3** | Report generation, AI Insights (Claude), full Dashboard | ✅ Complete |
| **Phase 4A** | WhatsApp integration (Twilio), templates, webhook, quiet hours | ✅ Complete |
| **Phase 4B** | AI Assistant — RAG chat, knowledge base, pgvector embeddings | ✅ Complete |
| **Phase 5** | Client management, ConfigService, Settings UI, Onboarding V2 | ✅ Complete |
| **Phase 6A** | GST Filing Calendar — deadline tracking, FILED/PENDING/OVERDUE status | ✅ Complete |
| **Phase 6B** | Document → Filing Period — `filingPeriod` field, OCR auto-extraction, manual override | ✅ Complete |
| **Phase 6C** | Persona-based module visibility — sidebar filtered by CA_FIRM/DISTRIBUTOR/MANUFACTURER | ✅ Complete |
| **Phase 6D** | Client magic-link uploads — `UploadToken`, public upload page, no Clerk required | ✅ Complete |
| **Phase 6E** | Email notifications — Resend-powered: document uploaded, OCR complete, deadline reminders | ✅ Complete |
| **Phase 6F** | Inbound WhatsApp → Documents routing | ✅ Complete |
| **Phase 7A** | Admin panel (`apps/admin`) — tenant CRUD, CSV import, config overrides, knowledge base | ✅ Complete |
| **Phase 7B** | Admin impersonation — 30-min token, single-use, orange impersonation banner | ✅ Complete |
| **Phase 7C** | System-wide config editor, platform stats, audit log in admin panel | ✅ Complete |
| **Phase 8A** | Production DB — migrated to Neon managed Postgres; 7-day point-in-time recovery, automated backups | ✅ Complete |
| **Phase 8B** | Production deployment — Railway (API Service + Web Service); auto-deploy on push to `main`; Sentry error monitoring | ✅ Complete |
| **Phase 8C** | Documents module v2 — `CLIENT_SALES_INVOICE` / `CLIENT_PURCHASE_INVOICE` types; `documentOwner`, `documentPurpose`, `gstinConflict` classification; Client column + filter controls (Type / Status / Purpose) in document list | ✅ Complete |
| **Phase 8D** | GST Reconciliation — GSTR-2B upload, line-item matching against purchase register, `ReconStatus` per line, reconciliation result summary | ✅ Complete |
| **Phase 8E** | Dashboard KPI trends — month-over-month % change with directional badges; sparkline data endpoint for 6-month receivables trend | ✅ Complete |

---

## 16. Roadmap

Phases 1–7 are complete. What follows is the honest gap analysis.

### Tier 1 — Blockers before first paying customer

| Item | Current state | What's needed |
|------|--------------|---------------|
| **Production deployment** | ✅ **Done** — Deployed on Railway (API Service + Web Service); auto-deploy on `git push main` | — |
| **Billing integration** | No billing | Stripe subscription plans (STARTER/GROWTH/ENTERPRISE); enforce plan limits |
| **S3 file storage** | Local `/tmp` disk — wiped on restart | AWS S3 or Cloudflare R2; update `StorageModule` |
| **WhatsApp production** | Twilio sandbox only | Twilio paid account OR Meta Business verification |
| **Error monitoring** | Silent failures | Sentry on both API and Web; catch prod crashes |
| **DB backups** | ✅ **Done** — Neon managed Postgres with 7-day point-in-time recovery | — |
| **Job queue** | OCR uses `setTimeout` — lost on restart | BullMQ + Redis workers for async jobs (not needed at current scale) |
| **Privacy policy + ToS** | No legal pages | `/privacy` + `/terms`; consent checkbox on sign-up; DPDP Act compliance |

> **Note:** Email notifications (Resend) are now complete. This was previously a Tier 1 blocker.

---

### Tier 2 — Should-have before scaling beyond 5 clients

| Item | Why it matters |
|------|---------------|
| **Full client portal login** | Upload tokens give clients one-shot upload, but a full portal with login + history requires Clerk org/subdomain + `CLIENT` role |
| **Scheduled reports** | Wire cron job (BullMQ) to existing `AUTO_REPORT_*` config keys + email delivery |
| **Rate limiting per plan** | `ThrottlerModule` with per-plan limits; 429 with upgrade prompt |
| **Audit log UI for tenants** | Surface `AuditLog` table in Settings → Activity tab (admin panel has it; tenant app does not) |
| **Multi-segment UI polish** | Distributor and Manufacturer paths are module-filtered but need persona-specific onboarding copy and inventory-heavy dashboard |

---

### Tier 3 — Post-PMF growth features

| Feature | Impact |
|---------|--------|
| **Tally integration** | One-way sync Tally → invoices — eliminates manual entry for the majority of CA firm clients |
| **GSTN API sync** | Auto-fetch filed returns from GSTN sandbox; requires GSP registration |
| **Analytics dashboard** | Firm growth metrics: revenue trend, client compliance rate |
| **Mobile app** | React Native + Expo; Indian accountants are mobile-first |
| **Workflow builder** | Visual automation: "overdue > 30 days → send WA + create doc request" |
| **Public API + webhooks** | API key auth; emit events on invoice.paid, document.processed |
| **White-labelling** | Custom domain + logo per `tenantConfig`; Clerk custom domain |

---

## 17. Competitive Differentiation

### vs TallyPrime

| Dimension | TallyPrime | OpsCopilot |
|-----------|-----------|-----------|
| Deployment | Desktop app (Windows) | Cloud SaaS, browser + mobile-ready |
| AI capabilities | None | Claude OCR, RAG assistant, AI insights |
| WhatsApp integration | None | Native Twilio integration |
| Client collaboration | None | Magic-link uploads, client portal (roadmap) |
| Multi-tenant | No | Yes — every CA firm is a separate tenant |
| Setup time | Hours (installation + config) | Minutes (sign up → onboarding wizard) |
| Real-time dashboard | No | Yes — live KPIs, aging charts |

**Our edge:** TallyPrime owns accounting data entry. OpsCopilot sits on top — it's the client-communication and compliance-tracking layer that Tally cannot provide. Not competing with Tally; complementary to it.

### vs ClearTax

| Dimension | ClearTax | OpsCopilot |
|-----------|---------|-----------|
| Primary use | GST return filing portal | Ops management for CA firms |
| Client communication | Email only | WhatsApp + email |
| Document management | Returns only | Full OCR pipeline for any document |
| Collections/receivables | None | Full aging + risk scoring |
| AI assistant | None | RAG chat over firm's own knowledge base |
| Admin panel | None | Full tenant management + impersonation |

**Our edge:** ClearTax is a filing tool. OpsCopilot is a running-the-firm tool. CA firms use both.

### vs Zoho Books / Zoho Practice

| Dimension | Zoho Books | OpsCopilot |
|-----------|-----------|-----------|
| Target | SME accounting | CA firm operations specifically |
| India-specific compliance | Good | Native — GSTIN/PAN validation, GST filing calendar, quarterly deadlines |
| WhatsApp | None | Native |
| AI | Basic automation | Claude-powered OCR, insights, RAG |
| Pricing complexity | Complex tiered | Simple 3-plan SaaS |

**Our edge:** Deep India-first design (Indian number formats, GSTIN/PAN regex, GST deadline logic, FilerType monthly/quarterly/annual). Zoho is a global product adapted for India.

### vs Vyapar

Vyapar targets small business owners. OpsCopilot targets CA firms managing multiple client businesses. Completely different buyer persona.

### Key Differentiators Summary

1. **AI-native from day one** — Claude for OCR, insights, and RAG. Not bolted on.
2. **India-first data model** — GSTIN, PAN, GST calendar, FilerType, quarterly deadlines baked into the schema.
3. **WhatsApp as a first-class channel** — Indian clients pay via WhatsApp, upload via WhatsApp. Most competitors treat it as an afterthought.
4. **Multi-tenant with persona routing** — CA firm, Distributor, Manufacturer each get a tailored experience from the same codebase.
5. **Client magic-link uploads** — eliminates the manual intermediary step for document collection. No competitor offers this.
6. **Admin panel + impersonation** — built-in operator tooling from day one. No need for direct DB access to manage customers.
7. **Config-driven business rules** — 37 tunable parameters per tenant (risk weights, thresholds, quiet hours). Enterprise-grade flexibility without custom code.

---

## 18. MVP Gap Analysis

These are the remaining items between the current codebase and a production-ready, revenue-generating product. Ordered by criticality.

### P0 — Must have before first paying user

| Gap | Effort | Why critical |
|-----|--------|-------------|
| **S3 file storage** | 1 day | Local disk is wiped on server restart. Every uploaded document is at risk. |
| **Job queue (BullMQ)** | 2 days | OCR + report generation run in `setTimeout`. Process restart drops them silently. |
| **Production deployment** | 2 days | No domain, no SSL, no prod config. Cannot give to a real user. |
| **Error monitoring (Sentry)** | 0.5 days | Silent failures in prod are invisible without this. |
| **DB backups** | ✅ Done | Migrated to Neon — 7-day point-in-time recovery, automated daily snapshots. |

### P1 — Must have before charging

| Gap | Effort | Why important |
|-----|--------|--------------|
| **Stripe billing** | 3 days | Cannot charge without a billing system. Also enforces plan limits. |
| **Privacy policy + ToS** | 1 day | Legal requirement. DPDP Act (India) requires explicit consent for data processing. |
| **WhatsApp production account** | 1 day (paperwork) | Sandbox only reaches pre-approved numbers. Useless for real clients. |

### P2 — Nice-to-have before launch

| Gap | Effort | Notes |
|-----|--------|-------|
| **Client portal (full login)** | 4 days | Magic-link uploads are built. Full portal requires Clerk sub-org or subdomain routing. |
| **Scheduled reports (auto-email)** | 2 days | Config keys already exist. Wire BullMQ scheduler + Resend email delivery. |
| **Audit log in tenant settings** | 1 day | Admin panel has it. Tenant-side users (especially CA firm compliance) want it too. |

### What is NOT a gap

- ✅ Email notifications (Resend) — complete
- ✅ GST filing calendar — complete
- ✅ Document filing period — complete
- ✅ Client magic-link uploads — complete
- ✅ Persona-based module visibility — complete
- ✅ Admin panel + impersonation — complete
- ✅ Inbound WhatsApp → documents — complete
- ✅ Database backups — Neon managed Postgres with 7-day point-in-time recovery
- ✅ Production deployment — Railway, auto-deploy on push to `main`
- ✅ Documents v2 — `CLIENT_SALES_INVOICE`, `CLIENT_PURCHASE_INVOICE`, document classification, client column + filter controls
- ✅ GSTR-2B reconciliation — line-item matching against purchase register
- ✅ Dashboard KPI trends — month-over-month % change badges
- ✅ Job queue (BullMQ) — removed from P0; not needed at current scale. Revisit when bulk WhatsApp sending is built.

---

## 19. Missing Winning Features

These are not in the roadmap yet but represent the highest-leverage growth opportunities based on how CA firms in India actually work.

### 1. WhatsApp-first document ingestion (High impact, Medium effort)

Indian clients respond to deadline nudges by photographing the document on their phone and sending it on WhatsApp. Today, inbound media is routed to OCR — but the loop is not closed: the client gets no confirmation, the CA has no status update.

**What to build:** When a client sends an image on WhatsApp → OCR processes it → WhatsApp reply to client: "✅ Received your GST return for Nov 2024. Processing now." → notification to CA when OCR completes. This closes the entire document collection loop inside WhatsApp without any portal login.

### 2. Filing compliance heatmap across all clients (High impact, Low effort)

A single page showing every client × every month as a colour-coded grid (green = filed, red = overdue, grey = not yet due). CA firms manage 50–200 clients; they need this bird's-eye view. Currently they have to scroll the calendar page per client.

**What to build:** `/filings/heatmap` — a 12-month × N-client matrix. Clickable cells open the document or upload prompt.

### 3. Late fee calculator (Medium impact, Low effort)

Every OVERDUE cell already has `daysRemaining` and `late_fee_rate_per_day` config. Show cumulative late fees per client on the calendar page. This creates urgency for both the CA and their client — a direct revenue recovery tool.

**What to build:** Add `lateFeeAccrued: daysOverdue * client.lateFeerate` to each `FilingRow`. Show in calendar and optionally include in the WhatsApp deadline nudge.

### 4. Client health score (Medium impact, Medium effort)

A composite 0–100 score per client derived from: filing compliance rate (last 12 months), payment timeliness (avgAgingDays), document submission rate. CA firms price their retainer fees partly on client complexity — a health score makes that visible and defensible.

**What to build:** `GET /clients/:id/health-score`. Surface as a badge on the client list page and client detail drawer.

### 5. Automated deadline nudges with escalation (High impact, Medium effort)

Today the CA has to manually trigger `POST /whatsapp/deadline-nudge`. In reality, CA firms want: "send a nudge 10 days before, then again 3 days before, then again on the day." With BullMQ already on the roadmap, scheduling this is straightforward.

**What to build:** BullMQ scheduler that runs daily, checks filing calendar, and sends escalating nudges at configurable intervals (config keys already exist: `whatsapp_nudge_window_days`).

### 6. Tally XML import (High impact, High effort — but unique)

No competitor offers automatic Tally → SaaS sync. ~90% of CA firm clients use Tally for accounting. If a CA can import a Tally XML export and have all invoices automatically appear in OpsCopilot, data entry drops to zero. This is a category-defining moat.

**What to build:** A file-upload endpoint that accepts Tally XML exports (format documented publicly), parses `VOUCHER` entries, creates `Invoice` rows. No Tally ODBC required — just XML file upload.

### 7. Client-facing mini-dashboard (High impact, High effort)

The magic-link upload page is built. The next step is giving clients a read-only view: their own outstanding invoices, filing status, and documents shared with them. No login needed (magic link authenticated). This reduces the CA's inbound "what's my status?" calls and is a visible value-add that clients feel.

**What to build:** Extend the magic-link token model with a `type` field (`UPLOAD` vs `PORTAL`). Portal tokens show a read-only client-scoped dashboard.

### 8. AI filing anomaly detection (Medium impact, Low effort — leverages existing stack)

When OCR processes a GST_RETURN, compare this month's values against the 3-month rolling average for the same client. If IGST jumped 300% or taxable supply is zero when it wasn't before, flag it as an anomaly before the return is filed.

**What to build:** Post-OCR hook in `DocumentsService` for `GST_RETURN` type — calls Claude with current + historical `extractedData` → returns `{ anomalies: [], confidence }` → stored as a new `InsightSeverity.WARNING` row.

---

*Multi-tenant · India-first · AI-native*
