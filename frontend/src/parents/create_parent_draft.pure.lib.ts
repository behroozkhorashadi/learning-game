import type { components } from '@app/api/openapi_schema.pure.lib.ts'

export type ParentCreateBody = components['schemas']['ParentCreate']

/** Mirrors backend/app/parents/parents_schemas_pure.py by hand. */
export const MIN_PARENT_PASSWORD = 4
export const MAX_PARENT_NAME = 40

export interface CreateParentDraft {
  readonly name: string
  readonly password: string
  readonly confirm: string
}

/** What's wrong with the draft, said to the grown-up, or null when it can be sent. */
export function createParentProblem(draft: CreateParentDraft): string | null {
  const name = draft.name.trim()
  if (name === '') return 'Add your name.'
  if (name.length > MAX_PARENT_NAME) return `Keep the name under ${String(MAX_PARENT_NAME)} characters.`
  if (draft.password.length < MIN_PARENT_PASSWORD) return `Pick a password of at least ${String(MIN_PARENT_PASSWORD)} characters.`
  if (draft.password !== draft.confirm) return 'The two passwords don’t match.'
  return null
}

export function parentCreateFrom(draft: CreateParentDraft): ParentCreateBody | null {
  return createParentProblem(draft) === null ? { name: draft.name.trim(), password: draft.password } : null
}
