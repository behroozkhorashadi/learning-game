/**
 * Plain-language formatting and chart arithmetic for the parent dashboard.
 * No React: every chart and section renders what these return.
 *
 * Dates arrive as ISO strings from the report and are read as calendar
 * values (never through the browser clock): "today" is the report's own
 * `today`, so the page says the same thing whenever it's opened.
 */

const MS_PER_DAY = 86_400_000
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** The report ranges a parent can pick. */
export const RANGE_OPTIONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

export type RangeDays = (typeof RANGE_OPTIONS)[number]['days']

/** "45 min", "1 h 5 min", "2 h". */
export function minutesText(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${String(hours)} h` : `${String(hours)} h ${String(rest)} min`
}

/** "3.4s" for a typical answer time. */
export function secondsText(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function pctText(pct: number | null): string {
  return pct === null ? '—' : `${String(pct)}%`
}

export function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`
}

/** Days since 1970 for a `YYYY-MM-DD` (or ISO datetime) string, read as a calendar date. */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / MS_PER_DAY
}

/** "Mon", for a `YYYY-MM-DD`. */
export function weekdayOf(iso: string): string {
  const index = (((dayNumber(iso) + 3) % 7) + 7) % 7 // 1970-01-01 was a Thursday
  return WEEKDAYS[index] ?? ''
}

export function weekdayName(index: number): string {
  return WEEKDAYS[index] ?? ''
}

/** "Oct 14". */
export function shortDate(iso: string): string {
  const month = Number(iso.slice(5, 7))
  return `${MONTHS[month - 1] ?? ''} ${String(Number(iso.slice(8, 10)))}`
}

/** "today", "yesterday", "3 days ago", or "never". */
export function lastPlayedText(lastPlayedAt: string | null, today: string): string {
  if (lastPlayedAt === null) return 'never'
  const days = Math.round(dayNumber(today) - dayNumber(lastPlayedAt))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${String(days)} days ago`
}

/** "3 PM", "12 AM". */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${String(twelve)} ${suffix}`
}

export type Direction = 'up' | 'down' | 'flat'

/** A change against the previous period, and whether that direction is good news. */
export interface Delta {
  readonly text: string
  readonly direction: Direction
  readonly good: boolean | null
}

/**
 * The change from `before` to `now`. `unit` is appended (" pts" for
 * percentages). `higherIsBetter` null means neither direction is good or bad
 * (time spent). Null when there's nothing to compare against.
 */
export function deltaOf(now: number | null, before: number | null, unit: string, higherIsBetter: boolean | null): Delta | null {
  if (now === null || before === null) return null
  const change = now - before
  if (change === 0) return { text: 'same as before', direction: 'flat', good: null }
  const direction: Direction = change > 0 ? 'up' : 'down'
  const good = higherIsBetter === null ? null : change > 0 === higherIsBetter
  return { text: `${change > 0 ? '+' : '−'}${String(Math.abs(change))}${unit}`, direction, good }
}

/** The change in a typical answer time, in tenths of a second. Faster is good. */
export function secondsDelta(nowMs: number | null, beforeMs: number | null): Delta | null {
  if (nowMs === null || beforeMs === null) return null
  const delta = deltaOf(Math.round(nowMs / 100), Math.round(beforeMs / 100), '', false)
  if (delta === null || delta.direction === 'flat') return delta
  const tenths = Math.abs(Math.round(nowMs / 100) - Math.round(beforeMs / 100))
  return { ...delta, text: `${delta.direction === 'up' ? '+' : '−'}${(tenths / 10).toFixed(1)}s` }
}

/** Clean axis ticks from 0 to at least `max`: 0/5/10, 0/20/40, … about `count` steps. */
export function niceTicks(max: number, count = 4): readonly number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(Math.round(t))
  return ticks
}

/** A first-try percentage on the five-step scale the facts grid and skills use. */
export type Mastery = 'none' | 'low' | 'mid' | 'good' | 'great'

export function masteryOf(firstTry: number, attempts: number): Mastery {
  if (attempts === 0) return 'none'
  const pct = (100 * firstTry) / attempts
  if (pct < 50) return 'low'
  if (pct < 75) return 'mid'
  if (pct < 90) return 'good'
  return 'great'
}

export const MASTERY_LABELS: Readonly<Record<Mastery, string>> = {
  none: 'Not seen yet',
  low: 'Under 50%',
  mid: '50–74%',
  good: '75–89%',
  great: '90%+',
}

/** The operators the facts grid shows, in the order kids meet them. */
export const OPERATORS = [
  { op: '+', label: 'Addition' },
  { op: '-', label: 'Subtraction' },
  { op: '×', label: 'Multiplication' },
  { op: '÷', label: 'Division' },
] as const

/** The display glyph for an operator (a real minus sign). */
export function operatorGlyph(op: string): string {
  return op === '-' ? '−' : op
}
