import { describe, expect, it } from 'vitest'
import { dayNumber, deltaOf, hourLabel, lastPlayedText, masteryOf, minutesText, niceTicks, operatorGlyph, pctText, secondsDelta, secondsText, shortDate, weekdayOf } from './report_format.pure.lib.ts'

describe('report formatting', () => {
  it('says time the way a parent would', () => {
    expect([minutesText(0), minutesText(45), minutesText(60), minutesText(65)]).toEqual(['0 min', '45 min', '1 h', '1 h 5 min'])
    expect(secondsText(4300)).toBe('4.3s')
    expect([pctText(null), pctText(80)]).toEqual(['—', '80%'])
    expect([hourLabel(0), hourLabel(9), hourLabel(12), hourLabel(15)]).toEqual(['12 AM', '9 AM', '12 PM', '3 PM'])
  })

  it('reads calendar dates without the browser clock', () => {
    expect(weekdayOf('2026-10-14')).toBe('Wed')
    expect(weekdayOf('2026-10-12')).toBe('Mon')
    expect(shortDate('2026-10-04T10:00:00')).toBe('Oct 4')
    expect(dayNumber('2026-10-15') - dayNumber('2026-10-14T23:59:00')).toBe(1)
  })

  it('says when they last played relative to the report day', () => {
    expect(lastPlayedText(null, '2026-10-14')).toBe('never')
    expect(lastPlayedText('2026-10-14T03:00:00', '2026-10-14')).toBe('today')
    expect(lastPlayedText('2026-10-13T23:00:00', '2026-10-14')).toBe('yesterday')
    expect(lastPlayedText('2026-10-09T23:00:00', '2026-10-14')).toBe('5 days ago')
  })

  it('judges a change by whether up is good', () => {
    expect(deltaOf(80, 70, ' pts', true)).toEqual({ text: '+10 pts', direction: 'up', good: true })
    expect(deltaOf(5, 9, '', true)).toEqual({ text: '−4', direction: 'down', good: false })
    expect(deltaOf(30, 20, ' min', null)?.good).toBeNull()
    expect(deltaOf(3, 3, '', true)?.direction).toBe('flat')
    expect(deltaOf(null, 3, '', true)).toBeNull()
    expect(secondsDelta(4300, 5200)).toEqual({ text: '−0.9s', direction: 'down', good: true })
    expect(secondsDelta(null, 5200)).toBeNull()
  })

  it('picks clean axis ticks', () => {
    expect(niceTicks(43)).toEqual([0, 20, 40, 60])
    expect(niceTicks(100, 4)).toEqual([0, 50, 100])
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(0)).toEqual([0, 1])
  })

  it('bands first-try rates for the facts grid', () => {
    expect([masteryOf(0, 0), masteryOf(1, 3), masteryOf(2, 3), masteryOf(4, 5), masteryOf(9, 10)]).toEqual(['none', 'low', 'mid', 'good', 'great'])
    expect(operatorGlyph('-')).toBe('−')
  })
})
