/**
 * The optional per-profile password, shared by the create and edit screens.
 * MIN_PASSWORD_LENGTH mirrors backend/app/services/profile_passwords.py by
 * hand, like the age bounds in profile_form.pure.lib.ts.
 */

export const MIN_PASSWORD_LENGTH = 4

export interface PasswordDraft {
  readonly password: string
  readonly confirm: string
  /** Edit screen only: drop the existing password. */
  readonly remove: boolean
}

export const EMPTY_PASSWORD_DRAFT: PasswordDraft = { password: '', confirm: '', remove: false }

/**
 * Why the draft can't be saved yet, or null. A blank draft is fine: it means
 * "no password" on create and "keep the current one" on edit.
 */
export function passwordDraftError(draft: PasswordDraft): string | null {
  if (draft.remove || (draft.password === '' && draft.confirm === '')) return null
  if (draft.password.length < MIN_PASSWORD_LENGTH) return `Use at least ${String(MIN_PASSWORD_LENGTH)} characters.`
  if (draft.password !== draft.confirm) return "The two passwords don't match yet."
  return null
}
