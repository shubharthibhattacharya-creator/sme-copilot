import { Logger } from '@nestjs/common'

const BACKOFF_MS = [30_000, 60_000, 120_000] as const // 30s, 60s, 120s

/**
 * Fire-and-forget retry wrapper.
 * Calls `fn` up to 3 times with exponential backoff (30s / 60s / 120s).
 * Does NOT block the caller — errors after all retries are logged and swallowed.
 */
export function retryAsync(
  fn: () => Promise<void>,
  logger: Logger,
  label: string,
  attempt = 0,
): void {
  fn().catch((err: unknown) => {
    const next = attempt + 1
    if (next < BACKOFF_MS.length) {
      const delay = BACKOFF_MS[attempt]!
      logger.warn(`${label} — attempt ${next} failed, retrying in ${delay / 1000}s`, err)
      setTimeout(() => retryAsync(fn, logger, label, next), delay)
    } else {
      logger.error(`${label} — all ${BACKOFF_MS.length} attempts failed`, err)
    }
  })
}
