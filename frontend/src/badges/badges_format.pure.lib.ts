import type { BadgeRecord } from '@app/api/badges_schema.pure.lib.ts'

/**
 * Presentation for the badges screen. Colors are presentation-only, keyed off
 * each badge's `key` (the backend has no notion of a display color). "Now" is
 * passed in, never read here.
 */

const BADGE_COLORS: Readonly<Record<string, { readonly bg: string; readonly border: string }>> = {
  'word-wizard': { bg: '#F6F0FF', border: '#EBDCFE' },
  'sound-master': { bg: '#F0FFEA', border: '#D8F5C8' },
  'quick-builder': { bg: '#FFF3E0', border: '#FFE0B2' },
}
const DEFAULT_EARNED_COLORS = { bg: '#FFF3E0', border: '#FFE0B2' }
const LOCKED_COLORS = { bg: '#F5F5F5', border: '#E0E0E0' }

export function badgeColors(badge: BadgeRecord): { readonly bg: string; readonly border: string } {
  if (!badge.earned) return LOCKED_COLORS
  return BADGE_COLORS[badge.key] ?? DEFAULT_EARNED_COLORS
}

export function formatEarnedDate(iso: string | null): string {
  if (iso === null || iso === '') return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatLastSession(iso: string | null, now: Date): string {
  if (iso === null || iso === '') return 'No sessions yet'
  const date = new Date(iso)
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
