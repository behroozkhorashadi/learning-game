import { describe, expect, it } from 'vitest'
import { badgeColors, formatAverageRating, formatLastSession, formatProgress } from './badges_format.pure.lib.ts'
import { BADGES } from './badges_fixtures.test.lib.ts'

describe('badges formatting', () => {
  it('colors earned badges by key and greys locked ones', () => {
    const [earned, locked] = BADGES
    if (earned === undefined || locked === undefined) throw new Error('fixture needs two badges')
    expect(badgeColors(earned)).toEqual({ bg: '#F6F0FF', border: '#EBDCFE' })
    expect(badgeColors(locked)).toEqual({ bg: '#F5F5F5', border: '#E0E0E0' })
    expect(badgeColors({ ...earned, key: 'new-badge' })).toEqual({ bg: '#FFF3E0', border: '#FFE0B2' })
  })

  it('says "Today at" only for a session on the same day as now', () => {
    expect(formatLastSession(null, new Date())).toBe('No sessions yet')
    expect(formatLastSession('2026-01-05T12:00:00', new Date('2026-01-05T20:00:00'))).toMatch(/^Today at /)
    expect(formatLastSession('2026-01-04T12:00:00', new Date('2026-01-05T20:00:00'))).not.toMatch(/^Today/)
  })

  it('formats progress and rating', () => {
    expect([formatProgress(null), formatProgress(10), formatProgress(-5)]).toEqual(['Not enough history yet', '↑ 10% improvement this month', '↓ 5% this month'])
    expect([formatAverageRating(null), formatAverageRating(4.25)]).toEqual(['No ratings yet', '4.3/5 stars'])
  })
})
