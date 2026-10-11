import { describe, expect, it } from 'vitest'
import { EMPTY_PASSWORD_DRAFT, passwordDraftError } from './profile_password.pure.lib.ts'

describe('passwordDraftError', () => {
  it('allows a blank draft (no password, or keep the current one) and a removal', () => {
    expect(passwordDraftError(EMPTY_PASSWORD_DRAFT)).toBeNull()
    expect(passwordDraftError({ password: 'x', confirm: '', remove: true })).toBeNull()
  })

  it('needs at least 4 characters, then a matching confirmation', () => {
    expect(passwordDraftError({ password: 'abc', confirm: 'abc', remove: false })).toBe('Use at least 4 characters.')
    expect(passwordDraftError({ password: 'tiger', confirm: 'tige', remove: false })).toBe("The two passwords don't match yet.")
    expect(passwordDraftError({ password: '', confirm: 'tiger', remove: false })).toBe('Use at least 4 characters.')
    expect(passwordDraftError({ password: 'tiger', confirm: 'tiger', remove: false })).toBeNull()
  })
})
