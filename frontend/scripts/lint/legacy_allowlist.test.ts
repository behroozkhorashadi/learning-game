import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classify } from './kinds.ts'
import { FRONTEND_ROOT, LEGACY_FILES, SRC_ROOT } from './paths.ts'

/**
 * The legacy allowlist only shrinks. Migrating a file removes its entry; this
 * test then requires lowering LEGACY_CEILING in the same PR, so the ratchet
 * never slips back. Raising the ceiling is an architecture change, made in review.
 */
const LEGACY_CEILING = 113

function listTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return listTs(full)
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [full] : []
  })
}

describe('legacy allowlist', () => {
  const entries = [...LEGACY_FILES]

  it('never grows', () => {
    expect(entries.length).toBeLessThanOrEqual(LEGACY_CEILING)
  })

  it('is tight: lower LEGACY_CEILING when you migrate a file', () => {
    expect(entries.length).toBe(LEGACY_CEILING)
  })

  it('lists only files that still exist', () => {
    expect(entries.filter((e) => !existsSync(path.join(FRONTEND_ROOT, e)))).toEqual([])
  })

  it('lists only files that still need it (no suffix yet)', () => {
    expect(entries.filter((e) => classify(path.basename(e)) !== null)).toEqual([])
  })

  it('covers every unsuffixed file in src/ — new files must follow the grammar', () => {
    const unsuffixed = listTs(SRC_ROOT)
      .filter((f) => classify(path.basename(f)) === null)
      .map((f) => path.relative(FRONTEND_ROOT, f).split(path.sep).join('/'))
    expect(unsuffixed.filter((f) => !LEGACY_FILES.has(f))).toEqual([])
  })
})
