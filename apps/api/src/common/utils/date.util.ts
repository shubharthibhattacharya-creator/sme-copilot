export function differenceInDays(from: Date, to: Date = new Date()): number {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
