/**
 * The feature-flag client. Lint (`app/flags-in-assembly`) allows importing it
 * as a value only from *.assembly.* files: assembly reads a flag and injects
 * the result, so tests and stories pass each mode in directly.
 *
 * Flags are switched on per page load with `?flags=a,b`. Unknown names are
 * ignored, so a stale bookmark can't enable anything.
 */

export const FLAG_NAMES = ['examples_todo_backup'] as const
export type FlagName = (typeof FLAG_NAMES)[number]

export interface FeatureFlags {
  readonly isEnabled: (name: FlagName) => boolean
}

function isFlagName(value: string): value is FlagName {
  return FLAG_NAMES.some((name) => name === value)
}

export function bindFeatureFlags({ search }: { readonly search: string }): FeatureFlags {
  const raw = new URLSearchParams(search).get('flags') ?? ''
  const enabled: ReadonlySet<FlagName> = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(isFlagName),
  )
  return { isEnabled: (name) => enabled.has(name) }
}
