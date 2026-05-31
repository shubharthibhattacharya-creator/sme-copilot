import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigKey } from './config-key.enum'
import { seedSystemConfig } from './config.seed'

const SAFE_DEFAULTS: Record<string, string> = {
  [ConfigKey.AGING_BUCKET_1_MAX]: '30',
  [ConfigKey.AGING_BUCKET_2_MAX]: '60',
  [ConfigKey.AGING_BUCKET_3_MAX]: '90',
  [ConfigKey.RISK_WEIGHT_AGING]: '0.5',
  [ConfigKey.RISK_WEIGHT_AMOUNT]: '0.3',
  [ConfigKey.RISK_WEIGHT_HISTORY]: '0.2',
  [ConfigKey.RISK_THRESHOLD_HIGH]: '0.7',
  [ConfigKey.RISK_THRESHOLD_MEDIUM]: '0.3',
  [ConfigKey.REMINDER_INTERVAL_DAYS]: '7',
  [ConfigKey.MAX_REMINDERS_PER_INVOICE]: '3',
  [ConfigKey.CRITICAL_CUSTOMER_COUNT]: '3',
  [ConfigKey.DELAY_MULTIPLIER]: '1.0',
  [ConfigKey.COLLECTIONS_DEFAULT_PAYMENT_TERMS_DAYS]: '30',
  [ConfigKey.INSIGHT_CRITICAL_OVERDUE_AMOUNT]: '100000',
  [ConfigKey.INSIGHT_WARNING_OVERDUE_COUNT]: '5',
  [ConfigKey.INSIGHT_WARNING_TREND_PERCENT]: '-10',
  [ConfigKey.INSIGHT_TREND_WINDOW_DAYS]: '7',
  [ConfigKey.MAX_INSIGHTS_PER_REFRESH]: '5',
  [ConfigKey.INSIGHT_MIN_SEVERITY]: '"INFO"',
  [ConfigKey.GST_DEADLINE_DAY]: '20',
  [ConfigKey.GST_DEADLINE_URGENCY_DAYS]: '5',
  [ConfigKey.QUARTERLY_DEADLINE_MONTHS]: '[4,7,10,1]',
  [ConfigKey.LATE_FEE_RATE_PER_DAY]: '50',
  [ConfigKey.GST_FILING_REMINDER_DAYS_BEFORE]: '7',
  [ConfigKey.GST_GRACE_PERIOD_DAYS]: '0',
  [ConfigKey.TDS_DEADLINE_DAY]: '7',
  [ConfigKey.MAX_FILE_SIZE_MB]: '10',
  [ConfigKey.CONFIDENCE_THRESHOLD_GREEN]: '0.8',
  [ConfigKey.CONFIDENCE_THRESHOLD_AMBER]: '0.6',
  [ConfigKey.AUTO_REJECT_BELOW_CONFIDENCE]: 'null',
  [ConfigKey.OCR_POLL_INTERVAL_SECONDS]: '3',
  [ConfigKey.DOCUMENT_CLASSIFICATION_MODE]: '"smart"',
  [ConfigKey.DOCUMENT_REQUEST_EXPIRY_DAYS]: '14',
  [ConfigKey.DOCUMENT_OCR_MAX_RETRIES]: '3',
  [ConfigKey.DEFAULT_REPORT_PERIOD]: '"current_month"',
  [ConfigKey.REPORT_POLL_INTERVAL_SECONDS]: '5',
  [ConfigKey.REPORT_TIMEOUT_SECONDS]: '120',
  [ConfigKey.AUTO_REPORT_ENABLED]: 'false',
  [ConfigKey.AUTO_REPORT_DAY_OF_MONTH]: '1',
  [ConfigKey.AUTO_REPORT_RECIPIENTS]: '[]',
  [ConfigKey.REPORT_RETENTION_DAYS]: '90',
  [ConfigKey.WHATSAPP_MAX_PER_MINUTE]: '10',
  [ConfigKey.WHATSAPP_NUDGE_WINDOW_DAYS]: '7',
  [ConfigKey.WHATSAPP_QUIET_HOURS_START]: '22',
  [ConfigKey.WHATSAPP_QUIET_HOURS_END]: '8',
  [ConfigKey.WHATSAPP_MAX_PER_INVOICE]: '3',
  [ConfigKey.WHATSAPP_DAILY_MESSAGE_LIMIT]: '100',
  [ConfigKey.WHATSAPP_RATE_LIMIT_PER_HOUR]: '20',
  [ConfigKey.WHATSAPP_AUTO_REPLY_ENABLED]: 'true',
}

// ── Cache entry ────────────────────────────────────────────────────────────────
interface CacheEntry {
  value: unknown
  expiresAt: number
}

const CACHE_TTL_MS = 60_000

export interface ConfigEntry {
  value: unknown
  isOverridden: boolean
  systemDefault: unknown
  defaultValue: unknown
  label: string
  description: string | null
  unit: string | null
  dataType: string
  category: string
  isPublic: boolean
  minValue?: unknown
  maxValue?: unknown
}

export type ConfigSnapshot = Record<string, ConfigEntry>

@Injectable()
export class ConfigService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConfigService.name)
  private readonly cache = new Map<string, CacheEntry>()

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await seedSystemConfig(this.prisma)
    } catch (err) {
      this.logger.error('Failed to seed SystemConfig on startup', err)
    }
  }

  private cacheKey(companyId: string, key: string) {
    return `${companyId}:${key}`
  }

  private getFromCache(companyId: string, key: string): unknown | undefined {
    const entry = this.cache.get(this.cacheKey(companyId, key))
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(this.cacheKey(companyId, key))
      return undefined
    }
    return entry.value
  }

  private setInCache(companyId: string, key: string, value: unknown) {
    this.cache.set(this.cacheKey(companyId, key), { value, expiresAt: Date.now() + CACHE_TTL_MS })
  }

  private invalidateCache(companyId: string, key: string) {
    this.cache.delete(this.cacheKey(companyId, key))
  }

  async get(companyId: string, key: ConfigKey): Promise<unknown> {
    const cached = this.getFromCache(companyId, key)
    if (cached !== undefined) return cached

    const [override, system] = await Promise.all([
      this.prisma.clientConfig.findUnique({ where: { companyId_key: { companyId, key } } }),
      this.prisma.systemConfig.findUnique({ where: { key } }),
    ])

    let value: unknown
    if (override) {
      value = JSON.parse(override.value) as unknown
    } else if (system) {
      value = JSON.parse(system.value) as unknown
    } else {
      const rawDefault = SAFE_DEFAULTS[key]
      if (rawDefault === undefined) {
        this.logger.warn(`ConfigService.get(${key}): no value found anywhere — returning null`)
        value = null
      } else {
        this.logger.warn(`ConfigService.get(${key}): falling back to SAFE_DEFAULT`)
        value = JSON.parse(rawDefault) as unknown
      }
    }

    this.setInCache(companyId, key, value)
    return value
  }

  async getNum(companyId: string, key: ConfigKey): Promise<number> {
    return (await this.get(companyId, key)) as number
  }

  async getBool(companyId: string, key: ConfigKey): Promise<boolean> {
    return (await this.get(companyId, key)) as boolean
  }

  async getStr(companyId: string, key: ConfigKey): Promise<string> {
    return (await this.get(companyId, key)) as string
  }

  async getAll(companyId: string, publicOnly = true): Promise<ConfigSnapshot> {
    const [system, client] = await Promise.all([
      this.prisma.systemConfig.findMany({ where: publicOnly ? { isPublic: true } : {} }),
      this.prisma.clientConfig.findMany({ where: { companyId } }),
    ])
    const clientMap = new Map(client.map((c) => [c.key, JSON.parse(c.value) as unknown]))

    return system.reduce<ConfigSnapshot>((acc, s) => {
      const sysVal = JSON.parse(s.value) as unknown
      const defVal = s.defaultValue ? (JSON.parse(s.defaultValue) as unknown) : sysVal
      acc[s.key] = {
        value: clientMap.has(s.key) ? clientMap.get(s.key) : sysVal,
        isOverridden: clientMap.has(s.key),
        systemDefault: sysVal,
        defaultValue: defVal,
        label: s.label,
        description: s.description ?? null,
        unit: s.unit ?? null,
        dataType: s.dataType,
        category: s.category,
        isPublic: s.isPublic,
        minValue: s.minValue ? (JSON.parse(s.minValue) as unknown) : undefined,
        maxValue: s.maxValue ? (JSON.parse(s.maxValue) as unknown) : undefined,
      }
      return acc
    }, {})
  }

  async set(companyId: string, key: ConfigKey, value: unknown, userId: string): Promise<void> {
    await this.prisma.clientConfig.upsert({
      where: { companyId_key: { companyId, key } },
      create: { companyId, key, value: JSON.stringify(value), updatedBy: userId },
      update: { value: JSON.stringify(value), updatedBy: userId },
    })
    this.invalidateCache(companyId, key)
  }

  async reset(companyId: string, key: ConfigKey): Promise<void> {
    await this.prisma.clientConfig.deleteMany({ where: { companyId, key } })
    this.invalidateCache(companyId, key)
  }

  async resetAll(companyId: string): Promise<void> {
    const rows = await this.prisma.clientConfig.findMany({ where: { companyId }, select: { key: true } })
    await this.prisma.clientConfig.deleteMany({ where: { companyId } })
    for (const { key } of rows) {
      this.invalidateCache(companyId, key)
    }
  }

  validateWeightSum(aging: number, amount: number, history: number): { valid: boolean; sum: number } {
    const sum = Math.round((aging + amount + history) * 1000) / 1000
    return { valid: Math.abs(sum - 1) < 0.001, sum }
  }
}
