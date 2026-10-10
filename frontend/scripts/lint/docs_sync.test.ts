import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLOR_ALLOWED, KIND_ALLOWED, RESERVED_TOKENS } from './kinds.ts'
import { FRONTEND_ROOT } from './paths.ts'

/** The docs and the lint tables must never disagree — mechanism, not memory. */

const REPO_ROOT = path.join(FRONTEND_ROOT, '..')
const read = (name: string): string => readFileSync(path.join(REPO_ROOT, name), 'utf8')

/** Parses a ✅/❌ markdown matrix between `<!-- name:start -->` and `<!-- name:end -->`. */
function parseMatrix(doc: string, name: string): Record<string, string[]> {
  const match = new RegExp(`<!-- ${name}:start -->([\\s\\S]*?)<!-- ${name}:end -->`).exec(doc)
  const body = match?.[1]
  if (body === undefined) throw new Error(`DEPENDENCIES.md is missing the ${name} block`)
  const rows = body
    .trim()
    .split('\n')
    .map((line) => line.split('|').map((cell) => cell.trim()).filter((cell) => cell !== ''))
  const [header, , ...data] = rows
  if (header === undefined) throw new Error(`${name} has no header row`)
  const columns = header.slice(1)
  return Object.fromEntries(data.map(([from = '', ...cells]) => [from, columns.filter((_, i) => cells[i] === '✅')]))
}

describe('DEPENDENCIES.md', () => {
  const doc = read('DEPENDENCIES.md')

  it('color matrix matches COLOR_ALLOWED', () => {
    expect(parseMatrix(doc, 'color-matrix')).toEqual(COLOR_ALLOWED)
  })

  it('kind matrix matches KIND_ALLOWED', () => {
    expect(parseMatrix(doc, 'kind-matrix')).toEqual(KIND_ALLOWED)
  })
})

describe('FILE_NAMING_CONVENTION.md', () => {
  it('lists exactly the reserved tokens', () => {
    const line = /`((?:[a-z]+ ?)+)` appear only in their slots/.exec(read('FILE_NAMING_CONVENTION.md'))?.[1]
    expect(line?.split(' ')).toEqual(RESERVED_TOKENS)
  })
})
