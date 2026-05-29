// ─── Subscription plan limits ─────────────────────────────────────────────────

export const PLAN_LIMITS = {
  STARTER: {
    users: 3,
    invoicesPerMonth: 100,
    aiInsightsPerDay: 10,
    storageGb: 1,
  },
  GROWTH: {
    users: 15,
    invoicesPerMonth: 1000,
    aiInsightsPerDay: 100,
    storageGb: 10,
  },
  ENTERPRISE: {
    users: Infinity,
    invoicesPerMonth: Infinity,
    aiInsightsPerDay: Infinity,
    storageGb: 100,
  },
} as const

// ─── Collection risk thresholds ───────────────────────────────────────────────

export const RISK_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.6,
  HIGH: 1.0,
} as const

// ─── Invoice aging buckets (days) ─────────────────────────────────────────────

export const AGING_BUCKETS = {
  CURRENT: { min: 0, max: 0 },
  BUCKET_1_30: { min: 1, max: 30 },
  BUCKET_31_60: { min: 31, max: 60 },
  BUCKET_61_90: { min: 61, max: 90 },
  BUCKET_90_PLUS: { min: 91, max: Infinity },
} as const

// ─── Indian currency formatting ───────────────────────────────────────────────

export const CURRENCY = {
  code: 'INR',
  symbol: '₹',
  locale: 'en-IN',
} as const

// ─── Cache TTLs (seconds) ─────────────────────────────────────────────────────

export const CACHE_TTL = {
  DASHBOARD: 300,      // 5 min
  AI_INSIGHTS: 3600,   // 1 hr
  COMPANY_CONFIG: 600, // 10 min
} as const
