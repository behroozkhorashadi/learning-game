/**
 * The filename grammar and the two import matrices — the single source of truth
 * for every architecture rule. Changing anything here means updating
 * DEPENDENCIES.md and FILE_NAMING_CONVENTION.md in the same PR
 * (see scripts/lint/AGENTS.md).
 *
 *   <basename>.<color>.<kind>.ts(x)
 *   <basename>.<color>.<kind>.test.ts(x)     ← fixtures classify as color `test`, kind `main`
 *   <basename>.<color>.<kind>.stories.tsx
 */

export const COLORS = ['test', 'assembly', 'effect', 'pure'] as const
export type Color = (typeof COLORS)[number]

export const KINDS = ['main', 'ui', 'hook', 'lib'] as const
export type Kind = (typeof KINDS)[number]

export type Fixture = 'test' | 'stories'

/** Who each color may import (higher may import same or lower, never up). */
export const COLOR_ALLOWED: Readonly<Record<Color, readonly Color[]>> = {
  test: ['test', 'assembly', 'effect', 'pure'],
  assembly: ['assembly', 'effect', 'pure'],
  effect: ['effect', 'pure'],
  pure: ['pure'],
}

/** Who each kind may import (higher may import same or lower, never up). */
export const KIND_ALLOWED: Readonly<Record<Kind, readonly Kind[]>> = {
  main: ['main', 'ui', 'hook', 'lib'],
  ui: ['ui', 'hook', 'lib'],
  hook: ['hook', 'lib'],
  lib: ['lib'],
}

/** Tokens that may only appear in their grammar slot, never as a basename segment. */
export const RESERVED_TOKENS: readonly string[] = [
  'pure',
  'effect',
  'assembly',
  'test',
  'main',
  'ui',
  'hook',
  'lib',
  'stories',
  'bind',
]

export const FILE_RE = /^(.+)\.(pure|effect|assembly|test)\.(main|ui|hook|lib)(?:\.(test|stories))?\.tsx?$/
export const SNAKE_CASE_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/

export interface Classified {
  readonly basename: string
  /** The color written in the filename. */
  readonly declaredColor: Color
  /** The kind written in the filename. */
  readonly declaredKind: Kind
  readonly fixture: Fixture | null
  /** The color used for import checks: `test` for fixtures. */
  readonly color: Color
  /** The kind used for import checks: `main` for fixtures. */
  readonly kind: Kind
}

function isColor(value: string): value is Color {
  return (COLORS as readonly string[]).includes(value)
}

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value)
}

/** Classifies a bare filename (no directories). Returns null if it doesn't fit the grammar. */
export function classify(fileName: string): Classified | null {
  const match = FILE_RE.exec(fileName)
  if (match === null) return null
  const [, basename, color, kind, fixture] = match
  if (basename === undefined || color === undefined || kind === undefined) return null
  if (!isColor(color) || !isKind(kind)) return null
  const fixtureValue: Fixture | null = fixture === 'test' || fixture === 'stories' ? fixture : null
  return {
    basename,
    declaredColor: color,
    declaredKind: kind,
    fixture: fixtureValue,
    color: fixtureValue === null ? color : 'test',
    kind: fixtureValue === null ? kind : 'main',
  }
}

/** True for tests, stories, and `*.test.*` helper files — the construct/stimulate/assert layer. */
export function isTestLayer(classified: Classified): boolean {
  return classified.color === 'test'
}
