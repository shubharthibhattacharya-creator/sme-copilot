/**
 * Keyword-based inbound WhatsApp message classifier.
 * Fast, no AI calls — handles the 90% common cases instantly.
 */

export type InboundIntent =
  | 'PAYMENT_CONFIRMATION'  // "Paid", "Done the transfer", "NEFT sent"
  | 'PROMISE_TO_PAY'        // "Will pay by Friday", "paying next week"
  | 'INVOICE_QUERY'         // "How much?", "What is due?", "balance?"
  | 'FILING_STATUS_QUERY'   // "GST done?", "filed?", "return status"
  | 'DOCUMENT_SENT_CONFIRM' // "Sent the doc", "check WhatsApp", "uploaded"
  | 'GREETING'              // "Hi", "Hello", "Good morning"
  | 'UNKNOWN'               // Anything else

export interface ClassificationResult {
  intent: InboundIntent
  /** Extracted date string for PROMISE_TO_PAY, null otherwise */
  promiseDate: string | null
}

// ── Keyword sets ──────────────────────────────────────────────────────────────

const PAYMENT_CONFIRMATION = [
  /\b(paid|payment\s*(done|sent|made|completed|transferred)|neft\s*(done|sent|transferred)|rtgs\s*(done|sent)|imps\s*(done|sent)|upi\s*(done|sent|paid)|transferred|remitted|deposited|cleared)\b/i,
  /\b(done\s*(the\s*)?payment|sent\s*(the\s*)?payment|payment\s*complete|amount\s*(paid|sent|transferred))\b/i,
  /\b(check\s*(your\s*)?account|credited|transaction\s*(id|ref|number|done)|txn\s*(done|id|ref))\b/i,
]

const PROMISE_TO_PAY = [
  /\b(will\s*(pay|send|transfer|do\s*(the\s*)?payment))\b/i,
  /\b(paying\s*(today|tomorrow|this\s*week|next\s*week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\b(by\s*(today|tomorrow|end\s*of\s*(day|week|month)))\b/i,
  /\b(in\s*(a\s*)?(few\s*)?(days?|hours?))\b/i,
  /\b(arrange\s*(by|before|within)|settle\s*(by|before|within)|clear\s*(by|before|within)|pay\s*by)\b/i,
]

const INVOICE_QUERY = [
  /\b(how\s*much|what('s|\s*is)\s*(the\s*)?(amount|due|balance|outstanding|pending))\b/i,
  /\b(balance|outstanding|due\s*(amount)?|pending\s*(amount)?|invoice\s*(amount|details|number))\b/i,
  /\b(total\s*(due|payable|pending)|amount\s*(to\s*)?(pay|be\s*paid)|fees?\s*(due|pending|payable))\b/i,
]

const FILING_STATUS = [
  /\b(gst|gstr|filing|return)\s*(done|filed|submitted|status|complete)\b/i,
  /\b(filed(\s*(already|yet))?|status\s*(of|for)?\s*(filing|gst|return)|filing\s*status)\b/i,
  /\b(when\s*(will|is)\s*(my|the)?\s*(gst|filing|return))\b/i,
  /\b(is\s*(my|the)?\s*(gst|filing|return)\s*(done|filed|submitted|complete))\b/i,
]

const DOCUMENT_SENT = [
  /\b(sent\s*(the\s*)?(doc(ument)?s?|file|pdf|image|photo|receipt|invoice|return))\b/i,
  /\b(doc(ument)?s?\s*(sent|shared|uploaded)|file\s*(sent|shared|uploaded)|shared\s*(the\s*)?(doc(ument)?s?|file))\b/i,
  /\b(check\s*(the\s*)?(doc(ument)?s?|file|whatsapp|attachment|photo)|uploaded|forwarded)\b/i,
]

const GREETING = [
  /^(hi+|hello+|hey+|namaste|good\s*(morning|afternoon|evening|day)|hiya|howdy|helo|hai|hii+)\W*$/i,
]

// ── Date extraction for promise-to-pay ────────────────────────────────────────

const NAMED_DAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
  friday: 5, saturday: 6, sunday: 0,
}

function extractPromiseDate(text: string): string | null {
  const lower = text.toLowerCase()

  if (/\btoday\b/.test(lower)) {
    return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  if (/\bend\s*of\s*week\b/.test(lower)) {
    const d = new Date()
    d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7 || 5)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  if (/\bnext\s*week\b/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  for (const [dayName, dayNum] of Object.entries(NAMED_DAYS)) {
    if (lower.includes(dayName)) {
      const today = new Date().getDay()
      const diff = ((dayNum - today + 7) % 7) || 7
      const d = new Date(); d.setDate(d.getDate() + diff)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }
  }

  // "by 15th", "by 20 Jan", "before 15 January"
  const dateMatch = text.match(/\b(\d{1,2})(st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\b/i)
  if (dateMatch) {
    return `${dateMatch[1]}${dateMatch[2] ?? ''}${dateMatch[3] ? ` ${dateMatch[3]}` : ''}`
  }

  return 'soon'
}

// ── Main classifier ────────────────────────────────────────────────────────────

export function classifyInboundMessage(text: string): ClassificationResult {
  const trimmed = text.trim()
  if (!trimmed) return { intent: 'UNKNOWN', promiseDate: null }

  if (GREETING.some((r) => r.test(trimmed))) {
    return { intent: 'GREETING', promiseDate: null }
  }

  if (PAYMENT_CONFIRMATION.some((r) => r.test(trimmed))) {
    return { intent: 'PAYMENT_CONFIRMATION', promiseDate: null }
  }

  if (PROMISE_TO_PAY.some((r) => r.test(trimmed))) {
    return { intent: 'PROMISE_TO_PAY', promiseDate: extractPromiseDate(trimmed) }
  }

  if (FILING_STATUS.some((r) => r.test(trimmed))) {
    return { intent: 'FILING_STATUS_QUERY', promiseDate: null }
  }

  if (INVOICE_QUERY.some((r) => r.test(trimmed))) {
    return { intent: 'INVOICE_QUERY', promiseDate: null }
  }

  if (DOCUMENT_SENT.some((r) => r.test(trimmed))) {
    return { intent: 'DOCUMENT_SENT_CONFIRM', promiseDate: null }
  }

  return { intent: 'UNKNOWN', promiseDate: null }
}
