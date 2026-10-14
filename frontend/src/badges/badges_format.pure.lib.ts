import type { BadgeCategory, BadgeRecord, BadgeTier, DayActivityRecord } from '@app/api/badges_schema.pure.lib.ts'

/**
 * Presentation for the badges screen: each tier's metal, each category's color
 * and words, progress and "why you got it" sentences, and the streak calendar.
 * "Now" is passed in, never read here.
 */

export interface TierStyle {
  readonly label: string
  /** Rim gradient, light to dark. */
  readonly rim: readonly [string, string, string]
  readonly ribbon: string
  /** Points on the medal's starburst rim. */
  readonly points: number
}

export const TIER_STYLES: Readonly<Record<BadgeTier, TierStyle>> = {
  bronze: { label: 'Bronze', rim: ['#F6C79B', '#C9824A', '#8A4F22'], ribbon: '#C0602F', points: 12 },
  silver: { label: 'Silver', rim: ['#FFFFFF', '#C3CCD8', '#7D8A9C'], ribbon: '#4F7BD9', points: 16 },
  gold: { label: 'Gold', rim: ['#FFF4B0', '#F7C531', '#C98A09'], ribbon: '#D6402F', points: 20 },
  legend: { label: 'Legendary', rim: ['#FF8FB8', '#A66CFF', '#3FC5FF'], ribbon: '#7B3FE4', points: 24 },
}

export interface CategoryStyle {
  readonly label: string
  /** The medal's face: light center, darker edge. */
  readonly face: readonly [string, string]
  /** What progress counts, after the number ("7 days in a row"). */
  readonly unit: string
}

export const CATEGORY_STYLES: Readonly<Record<BadgeCategory, CategoryStyle>> = {
  streaks: { label: 'Streaks', face: ['#FFB25B', '#F0542B'], unit: 'days in a row' },
  days: { label: 'Days played', face: ['#6FE3D0', '#119C8B'], unit: 'days played' },
  time: { label: 'Time played', face: ['#C9A2FF', '#7740D9'], unit: 'minutes played' },
  rounds: { label: 'Rounds', face: ['#7FB2FF', '#2457D6'], unit: 'rounds' },
  accuracy: { label: 'Right in a row', face: ['#9EEB7C', '#3C9A1E'], unit: 'right in a row' },
  speed: { label: 'Speed', face: ['#FFE066', '#E89B00'], unit: 'fast right answers' },
  games: { label: 'Game masters', face: ['#8EF0A6', '#1F8A54'], unit: 'right answers' },
  explorer: { label: 'Explorer', face: ['#7FDBFF', '#1478B8'], unit: 'games tried' },
  creator: { label: 'Creator', face: ['#FF9ED8', '#C2338E'], unit: 'stories' },
  legend: { label: 'Legend', face: ['#FFE7A0', '#D98A00'], unit: 'badges' },
}

/** Shelf sections, in order. */
export const CATEGORY_ORDER: readonly BadgeCategory[] = ['streaks', 'days', 'time', 'rounds', 'accuracy', 'speed', 'games', 'explorer', 'creator', 'legend']

export interface ShelfSection {
  readonly category: BadgeCategory
  readonly badges: readonly BadgeRecord[]
}

/** The badges grouped by category, in shelf order, skipping empty ones. */
export function shelfSections(badges: readonly BadgeRecord[]): readonly ShelfSection[] {
  return CATEGORY_ORDER.map((category) => ({ category, badges: badges.filter((b) => b.category === category) })).filter((s) => s.badges.length > 0)
}

/** 0 to 1: how close a badge is. Earned is always full. */
export function progressFraction(badge: BadgeRecord): number {
  if (badge.earned) return 1
  if (badge.progress === null || badge.goal === null || badge.goal <= 0) return 0
  return Math.min(1, Math.max(0, badge.progress / badge.goal))
}

/** "7 of 10 days in a row", or null for a badge that doesn't count. */
export function progressText(badge: BadgeRecord): string | null {
  if (badge.progress === null || badge.goal === null) return null
  const unit = CATEGORY_STYLES[badge.category].unit
  return `${formatCount(Math.min(badge.progress, badge.goal))} of ${formatCount(badge.goal)} ${unit}`
}

/** "3 more to go!", or null once there's nothing left (or nothing counted). */
export function toGoText(badge: BadgeRecord): string | null {
  if (badge.earned || badge.progress === null || badge.goal === null) return null
  const left = badge.goal - badge.progress
  return left > 0 ? `${formatCount(left)} more to go!` : null
}

/** For an earned badge that kept counting: "Your best so far: 47 right in a row". */
export function bestSoFarText(badge: BadgeRecord): string | null {
  if (!badge.earned || badge.progress === null || badge.goal === null || badge.progress <= badge.goal) return null
  return `Your best so far: ${formatCount(badge.progress)} ${CATEGORY_STYLES[badge.category].unit}`
}

/** "Earned Oct 2 while playing Zombie Horde". */
export function earnedWhenText(badge: BadgeRecord): string {
  const date = formatEarnedDate(badge.awarded_at)
  const when = date === '' ? 'Earned' : `Earned ${date}`
  return badge.earned_in_game === null ? when : `${when} while playing ${badge.earned_in_game}`
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** A server timestamp. The backend stores UTC and sends it without a zone; read it as UTC, not local time. */
export function serverTime(iso: string): Date {
  return new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)
}

export function formatEarnedDate(iso: string | null): string {
  if (iso === null || iso === '') return ''
  return serverTime(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** "45 min", "1 hr 5 min", "2 hr", or "Under a minute". */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return 'Under a minute'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${String(rest)} min`
  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`
}

export function formatLastSession(iso: string | null, now: Date): string {
  if (iso === null || iso === '') return 'No sessions yet'
  const date = serverTime(iso)
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return date.toDateString() === now.toDateString() ? `Today at ${time}` : `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}

export function formatProgress(pct: number | null): string {
  if (pct === null) return 'Not enough history yet'
  if (pct >= 0) return `↑ ${String(pct)}% improvement this month`
  return `↓ ${String(Math.abs(pct))}% this month`
}

export function formatAverageRating(rating: number | null): string {
  return rating === null ? 'No ratings yet' : `${rating.toFixed(1)}/5 stars`
}

// --- The streak calendar ---

/** A day as the backend names it: YYYY-MM-DD on the family's calendar. */
export function isoDay(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A YYYY-MM-DD day at local midnight (never parsed as UTC). */
export function dayFromIso(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** "Mon, Oct 12". */
export function formatDay(iso: string): string {
  return dayFromIso(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export interface CalendarCell {
  readonly day: string
  readonly played: DayActivityRecord | null
  /** Part of the current streak. */
  readonly inStreak: boolean
  readonly isToday: boolean
  readonly isFuture: boolean
}

/**
 * Six weeks, Monday first, ending with the week that holds `today`. A day is in
 * the streak when it's one of the `streak` days in a row that end today, or
 * yesterday when today hasn't been played yet.
 */
export function streakCalendar(days: readonly DayActivityRecord[], streak: number, today: Date): readonly (readonly CalendarCell[])[] {
  const byDay = new Map(days.map((d) => [d.day, d]))
  const todayIso = isoDay(today)
  const streakEnd = byDay.has(todayIso) ? today : addDays(today, -1)
  const streakDays = new Set(Array.from({ length: streak }, (_, i) => isoDay(addDays(streakEnd, -i))))
  const mondayOffset = (today.getDay() + 6) % 7
  const firstMonday = addDays(today, -mondayOffset - 35)
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = addDays(firstMonday, week * 7 + weekday)
      const day = isoDay(date)
      return { day, played: byDay.get(day) ?? null, inStreak: streakDays.has(day), isToday: day === todayIso, isFuture: date.getTime() > today.getTime() }
    }),
  )
}

/** How bright a calendar day is, 0 (not played) to 4 (a long day). */
export function heatLevel(minutes: number | null): 0 | 1 | 2 | 3 | 4 {
  if (minutes === null) return 0
  if (minutes < 5) return 1
  if (minutes < 15) return 2
  if (minutes < 30) return 3
  return 4
}

/** "28 of 30 right (93%)", or "No answers" for a day with none. */
export function accuracyText(day: DayActivityRecord): string {
  if (day.rounds === 0) return 'No answers'
  return `${formatCount(day.correct)} of ${formatCount(day.rounds)} right (${String(Math.round((day.correct / day.rounds) * 100))}%)`
}
