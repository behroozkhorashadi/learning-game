import { describe, expect, it } from 'vitest'
import { MAX_AGE, MIN_AGE, ageFromBirthday, ageOf, birthYearOf, birthdayBounds, defaultReadingSupport, isAgeInRange } from './profile_form.pure.lib.ts'

describe('profile form rules', () => {
  it('reads the birth year and age from an ISO birthday', () => {
    expect(birthYearOf('2019-05-12')).toBe(2019)
    expect(ageOf(2019, 2026)).toBe(7)
    expect(ageFromBirthday('2019-05-12', 2026)).toBe(7)
    expect(ageFromBirthday('', 2026)).toBeNull()
  })

  it('accepts ages from MIN_AGE to MAX_AGE inclusive', () => {
    expect([MIN_AGE - 1, MIN_AGE, MAX_AGE, MAX_AGE + 1].map(isAgeInRange)).toEqual([false, true, true, false])
  })

  it('bounds the birthday input from the oldest supported year to today', () => {
    expect(birthdayBounds('2026-10-10')).toEqual({ min: '1927-01-01', max: '2026-10-10' })
  })

  it('defaults reading support on for 6 and under', () => {
    expect(defaultReadingSupport('2020-12-31', 2026)).toBe(true)
    expect(defaultReadingSupport('2019-01-01', 2026)).toBe(false)
  })
})
