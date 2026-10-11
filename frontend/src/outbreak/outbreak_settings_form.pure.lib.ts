import type { PracticeConfigRecord, PracticeConfigUpsert } from '@app/api/practice_config_schema.pure.lib.ts'

/**
 * Equation Outbreak's practice settings, as a form: which operations are in
 * play, which fact-family numbers to focus on per operation, and a pinned
 * difficulty. Off ("automatic") means no saved config: the adaptive level
 * engine decides (backend app/models/practice_config.py has the tradeoff).
 */

export const OPERATIONS = [
  { key: '+', label: 'Addition' },
  { key: '-', label: 'Subtraction' },
  { key: '×', label: 'Multiplication' },
  { key: '÷', label: 'Division' },
] as const

/**
 * Every operation offers the same focus range. A value that can't be used (an
 * 11 focus at a difficulty whose operands stop lower) is ignored server-side
 * (draw_operands_with_focus's `usable` filter), so this needn't vary.
 */
export const FOCUS_NUMBER_OPTIONS: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1)

export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 10

export function difficultyLabel(value: number): string {
  if (value <= 2) return 'Warm-up'
  if (value <= 4) return 'Building confidence'
  if (value <= 7) return 'Steady challenge'
  return 'Advanced'
}

export interface SettingsDraft {
  /** Custom settings on; off means automatic difficulty. */
  readonly custom: boolean
  /** In OPERATIONS order; never empty. */
  readonly operations: readonly string[]
  readonly focusNumbers: Readonly<Record<string, readonly number[]>>
  readonly difficulty: number
}

/** The form for a saved config, or the defaults (automatic, every operation, mid difficulty) when there is none. */
export function draftFrom(config: PracticeConfigRecord | null): SettingsDraft {
  if (config === null) return { custom: false, operations: OPERATIONS.map((op) => op.key), focusNumbers: {}, difficulty: 5 }
  return { custom: true, operations: config.operations, focusNumbers: config.focus_numbers, difficulty: config.difficulty }
}

/** Turns an operation on or off; the last remaining one stays on. */
export function toggleOperation(draft: SettingsDraft, op: string): SettingsDraft {
  if (draft.operations.includes(op)) {
    return draft.operations.length === 1 ? draft : { ...draft, operations: draft.operations.filter((o) => o !== op) }
  }
  return { ...draft, operations: OPERATIONS.map((o) => o.key).filter((key) => key === op || draft.operations.includes(key)) }
}

export function toggleFocusNumber(draft: SettingsDraft, op: string, value: number): SettingsDraft {
  const current = draft.focusNumbers[op] ?? []
  const next = current.includes(value) ? current.filter((n) => n !== value) : [...current, value]
  return { ...draft, focusNumbers: { ...draft.focusNumbers, [op]: next } }
}

/** What saving does: write the settings, clear saved ones (custom turned off), or nothing (it was never on). */
export type SettingsSave = { readonly kind: 'save'; readonly config: PracticeConfigUpsert } | { readonly kind: 'clear' } | { readonly kind: 'none' }

export function settingsSave(draft: SettingsDraft, hadSavedConfig: boolean, profileId: number, gameId: string): SettingsSave {
  if (draft.custom) {
    return { kind: 'save', config: { profile_id: profileId, game_id: gameId, operations: draft.operations, focus_numbers: draft.focusNumbers, difficulty: draft.difficulty } }
  }
  return hadSavedConfig ? { kind: 'clear' } : { kind: 'none' }
}
