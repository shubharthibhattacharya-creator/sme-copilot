import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { ConfigKey } from './config-key.enum'

// Hardcoded safety-net defaults (should never hit in prod if seed ran)
const CONFIG_DEFAULTS: Record<string, unknown> = {
  [ConfigKey.AGING_BUCKET_1_MAX]: 30,
  [ConfigKey.AGING_BUCKET_2_MAX]: 60,
  [ConfigKey.AGING_BUCKET_3_MAX]: 90,
  [ConfigKey.RISK_WEIGHT_AGING]: 0.5,
  [ConfigKey.RISK_WEIGHT_AMOUNT]: 0.3,
  [ConfigKey.RISK_WEIGHT_HISTORY]: 0.2,
  [ConfigKey.RISK_THRESHOLD_HIGH]: 0.7,
  [ConfigKey.RISK_THRESHOLD_MEDIUM]: 0.3,
  [ConfigKey.REMINDER_INTERVAL_DAYS]: 7,
  [ConfigKey.MAX_REMINDERS_PER_INVOICE]: 3,
  [ConfigKey.CRITICAL_CUSTOMER_COUNT]: 3,
  [ConfigKey.DELAY_MULTIPLIER]: 1.0,
  [ConfigKey.INSIGHT_CRITICAL_OVERDUE_AMOUNT]: 100000,
  [ConfigKey.INSIGHT_WARNING_OVERDUE_COUNT]: 5,
  [ConfigKey.INSIGHT_WARNING_TREND_PERCENT]: -10,
  [ConfigKey.INSIGHT_TREND_WINDOW_DAYS]: 7,
  [ConfigKey.MAX_INSIGHTS_PER_REFRESH]: 5,
  [ConfigKey.GST_DEADLINE_DAY]: 20,
  [ConfigKey.GST_DEADLINE_URGENCY_DAYS]: 10,
  [ConfigKey.QUARTERLY_DEADLINE_MONTHS]: [4, 7, 10, 1],
  [ConfigKey.LATE_FEE_RATE_PER_DAY]: 50,
  [ConfigKey.MAX_FILE_SIZE_MB]: 10,
  [ConfigKey.CONFIDENCE_THRESHOLD_GREEN]: 0.8,
  [ConfigKey.CONFIDENCE_THRESHOLD_AMBER]: 0.6,
  [ConfigKey.AUTO_REJECT_BELOW_CONFIDENCE]: null,
  [ConfigKey.OCR_POLL_INTERVAL_SECONDS]: 3,
  [ConfigKey.DEFAULT_REPORT_PERIOD]: 'current_month',
  [ConfigKey.REPORT_POLL_INTERVAL_SECONDS]: 5,
  [ConfigKey.REPORT_TIMEOUT_SECONDS]: 30,
  [ConfigKey.AUTO_REPORT_ENABLED]: false,
  [ConfigKey.AUTO_REPORT_DAY_OF_MONTH]: 1,
  [ConfigKey.AUTO_REPORT_RECIPIENTS]: [],
  [ConfigKey.WHATSAPP_MAX_PER_MINUTE]: 10,
  [ConfigKey.WHATSAPP_NUDGE_WINDOW_DAYS]: 7,
  [ConfigKey.WHATSAPP_QUIET_HOURS_START]: 22,
  [ConfigKey.WHATSAPP_QUIET_HOURS_END]: 8,
  [ConfigKey.WHATSAPP_MAX_PER_INVOICE]: 3,
}

export interface ConfigEntry {
  value: unknown
  isOverridden: boolean
  systemDefault: unknown
  label: string
  description: string | null
  unit: string | null
  dataType: string
  category: string
  minValue?: unknown
  maxValue?: unknown
}

export type ConfigSnapshot = Record<string, ConfigEntry>

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name)

  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, key: ConfigKey): Promise<unknown> {
    const [override, system] = await Promise.all([
      this.prisma.clientConfig.findUnique({ where: { companyId_key: { companyId, key } } }),
      this.prisma.systemConfig.findUnique({ where: { key } }),
    ])

    if (override) return JSON.parse(override.value) as unknown
    if (system) return JSON.parse(system.value) as unknown

    this.logger.warn(`ConfigService.get(${key}): falling back to hardcoded default — run seed`)
    return CONFIG_DEFAULTS[key]
  }

  async getNum(companyId: string, key: ConfigKey): Promise<number> {
    return (await this.get(companyId, key)) as number
  }

  async getBool(companyId: string, key: ConfigKey): Promise<boolean> {
    return (await this.get(companyId, key)) as boolean
  }

  async getAll(companyId: string): Promise<ConfigSnapshot> {
    const [system, client] = await Promise.all([
      this.prisma.systemConfig.findMany(),
      this.prisma.clientConfig.findMany({ where: { companyId } }),
    ])
    const clientMap = new Map(client.map((c) => [c.key, JSON.parse(c.value) as unknown]))

    return system.reduce<ConfigSnapshot>((acc, s) => {
      const sysVal = JSON.parse(s.value) as unknown
      acc[s.key] = {
        value: clientMap.has(s.key) ? clientMap.get(s.key) : sysVal,
        isOverridden: clientMap.has(s.key),
        systemDefault: sysVal,
        label: s.label,
        description: s.description,
        unit: s.unit,
        dataType: s.dataType,
        category: s.category,
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
  }

  async reset(companyId: string, key: ConfigKey): Promise<void> {
    await this.prisma.clientConfig.deleteMany({ where: { companyId, key } })
  }
}
