/**
 * Where the governed tree is, which files are legacy, and how import
 * specifiers resolve against the real `src/` tree. Every rule self-gates
 * through `governedFile` so the plugin is inert on tooling and on
 * allowlisted legacy files.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { classify, type Classified } from './kinds.ts'

export const FRONTEND_ROOT = fileURLToPath(new URL('../..', import.meta.url))
export const SRC_ROOT = path.join(FRONTEND_ROOT, 'src')
export const ALIAS_PREFIX = '@app/'

const ALLOWLIST_PATH = fileURLToPath(new URL('./legacy_allowlist.json', import.meta.url))

function loadAllowlist(): ReadonlySet<string> {
  const parsed: unknown = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  if (!Array.isArray(parsed) || !parsed.every((entry): entry is string => typeof entry === 'string')) {
    throw new Error(`${ALLOWLIST_PATH} must be a JSON array of frontend-relative paths`)
  }
  return new Set(parsed)
}

/** Frontend-relative paths (e.g. `src/App.tsx`) exempt from the architecture rules until migrated. */
export const LEGACY_FILES: ReadonlySet<string> = loadAllowlist()

export const TS_FILE_RE = /\.tsx?$/

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

/** `src`-relative posix path, or null when the file is outside `src/`. */
export function srcRelative(absPath: string): string | null {
  const rel = path.relative(SRC_ROOT, absPath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  return toPosix(rel)
}

export function isLegacy(absPath: string): boolean {
  return LEGACY_FILES.has(toPosix(path.relative(FRONTEND_ROOT, absPath)))
}

/** The feature a `src`-relative path belongs to: its first directory, or null for files at `src/` root. */
export function featureOf(srcRel: string): string | null {
  const slash = srcRel.indexOf('/')
  return slash === -1 ? null : srcRel.slice(0, slash)
}

export interface GovernedFile {
  readonly absPath: string
  readonly srcRel: string
  readonly feature: string | null
  readonly fileName: string
  /** Null when the filename doesn't fit the grammar (itself a violation, reported by layer-imports). */
  readonly classified: Classified | null
}

/** The governed view of a file, or null if no architecture rule applies to it. */
export function governedFile(absPath: string): GovernedFile | null {
  if (!TS_FILE_RE.test(absPath) || absPath.endsWith('.d.ts')) return null
  const srcRel = srcRelative(absPath)
  if (srcRel === null || isLegacy(absPath)) return null
  const fileName = path.basename(absPath)
  return { absPath, srcRel, feature: featureOf(srcRel), fileName, classified: classify(fileName) }
}

/** Like `governedFile`, but also covers legacy files — for rules (security, barrels) that apply everywhere in `src/`. */
export function srcFile(absPath: string): GovernedFile | null {
  if (!TS_FILE_RE.test(absPath) || absPath.endsWith('.d.ts')) return null
  const srcRel = srcRelative(absPath)
  if (srcRel === null) return null
  const fileName = path.basename(absPath)
  return { absPath, srcRel, feature: featureOf(srcRel), fileName, classified: classify(fileName) }
}

export type Resolved =
  | { readonly type: 'package' }
  | { readonly type: 'file'; readonly absPath: string; readonly via: 'relative' | 'alias' }
  | { readonly type: 'directory'; readonly absPath: string; readonly via: 'relative' | 'alias' }
  | { readonly type: 'missing'; readonly absPath: string; readonly via: 'relative' | 'alias' }

const EXTENSIONS = ['', '.ts', '.tsx'] as const

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile()
}

/** Resolves an import specifier the way Vite/TS do for this repo (`@app/*` → `src/*`, optional `.ts(x)`). */
export function resolveImport(fromAbsPath: string, specifier: string): Resolved {
  let base: string
  let via: 'relative' | 'alias'
  if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromAbsPath), specifier)
    via = 'relative'
  } else if (specifier.startsWith(ALIAS_PREFIX)) {
    base = path.join(SRC_ROOT, specifier.slice(ALIAS_PREFIX.length))
    via = 'alias'
  } else {
    return { type: 'package' }
  }
  for (const ext of EXTENSIONS) {
    if (isFile(base + ext)) return { type: 'file', absPath: base + ext, via }
  }
  if (existsSync(base) && statSync(base).isDirectory()) return { type: 'directory', absPath: base, via }
  return { type: 'missing', absPath: base, via }
}

/** The alias specifier for a file under `src/`, e.g. `@app/examples/todo/todo.pure.ui.tsx`. */
export function aliasFor(absPath: string): string | null {
  const rel = srcRelative(absPath)
  return rel === null ? null : `${ALIAS_PREFIX}${rel}`
}

/** A `./`-prefixed relative specifier from one file to another. */
export function relativeSpecifier(fromAbsPath: string, toAbsPath: string): string {
  const rel = toPosix(path.relative(path.dirname(fromAbsPath), toAbsPath))
  return rel.startsWith('.') ? rel : `./${rel}`
}
