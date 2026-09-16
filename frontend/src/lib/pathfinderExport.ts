/**
 * Pathfinder: No Way Back — turns a built `DotPuzzle` into the TS object
 * literal that belongs in `pathfinderLevels.ts`. The map builder can check
 * solvability and preview the solution, but it can't write to the repo's
 * source itself (no backend, and browsers can't edit files on disk) — this
 * is the bridge: the builder exports the code, a person pastes it in, it
 * gets added to the curated set by hand (with its own solver-verified test,
 * same as every other level).
 */

import type { DotPuzzle, Difficulty, GridPosition } from './pathfinderTypes'

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
  return slug || 'map'
}

export function makeLevelId(difficulty: Difficulty, name: string): string {
  return `${difficulty}-${slugify(name)}`
}

function sortedDots(dots: GridPosition[]): GridPosition[] {
  return [...dots].sort((a, b) => a.row - b.row || a.col - b.col)
}

export function formatLevelCode(puzzle: DotPuzzle): string {
  const dotsLines = sortedDots(puzzle.dots)
    .map((d) => `      { row: ${d.row}, col: ${d.col} },`)
    .join('\n')
  return [
    '{',
    `  id: '${puzzle.id}',`,
    `  name: '${(puzzle.name ?? '').replace(/'/g, "\\'")}',`,
    `  difficulty: '${puzzle.difficulty}',`,
    `  rows: ${puzzle.rows},`,
    `  columns: ${puzzle.columns},`,
    '  dots: [',
    dotsLines,
    '  ],',
    '},',
  ].join('\n')
}
