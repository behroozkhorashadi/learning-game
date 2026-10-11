/**
 * Age and birthday rules shared by the create and edit screens, so the two
 * forms can't drift apart. Mirrors backend/app/models/profile.py's
 * MIN_AGE/MAX_AGE by hand: these are sanity bounds, not values expected to
 * change independently on either side.
 *
 * Dates are ISO `YYYY-MM-DD` strings. "Today" is always passed in (the
 * caller's injected clock), never read here.
 */

export const MIN_AGE = 1
export const MAX_AGE = 99
/** PRD §8: reading support is on by default for the 6 band and younger. */
export const READING_SUPPORT_DEFAULT_MAX_AGE = 6

export function yearOf(isoDate: string): number {
  return Number(isoDate.split('-')[0])
}

/** Only the year is persisted; see `Profile`'s docstring for why year, not band. */
export const birthYearOf = yearOf

export function ageOf(birthYear: number, currentYear: number): number {
  return currentYear - birthYear
}

export function isAgeInRange(age: number): boolean {
  return age >= MIN_AGE && age <= MAX_AGE
}

/** The date-input bounds: from Jan 1 of the oldest supported birth year up to today. */
export function birthdayBounds(today: string): { readonly min: string; readonly max: string } {
  return { min: `${String(yearOf(today) - MAX_AGE)}-01-01`, max: today }
}

/** The age a birthday implies, or null while the field is empty. */
export function ageFromBirthday(birthday: string, currentYear: number): number | null {
  return birthday === '' ? null : ageOf(birthYearOf(birthday), currentYear)
}

export function defaultReadingSupport(birthday: string, currentYear: number): boolean {
  return birthYearOf(birthday) >= currentYear - READING_SUPPORT_DEFAULT_MAX_AGE
}
