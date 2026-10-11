import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { assessDifficulty } from './pathfinder_difficulty.pure.lib.ts'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'
import { fakePathfinderScreens } from './pathfinder_screens.test.ui.tsx'
import type { DotPuzzle } from './pathfinder_state.pure.lib.ts'

afterEach(cleanup)

const { LevelGallery } = fakePathfinderScreens()
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const card = (puzzle: DotPuzzle): HTMLElement => screen.getByRole('button', { name: new RegExp(`^${escape(puzzle.name ?? puzzle.id)}$`) })

function levelWhere(predicate: (p: DotPuzzle) => boolean): DotPuzzle {
  const found = ALL_LEVELS.find(predicate)
  if (found === undefined) throw new Error('no curated level matches')
  return found
}

describe('PathfinderLevelGallery', () => {
  it('shows every curated level, unlocked, across all difficulty tiers', () => {
    render(<LevelGallery />)
    expect(screen.getByText(`Dev QA — every level unlocked (${String(ALL_LEVELS.length)} total)`)).toBeTruthy()
    for (const puzzle of ALL_LEVELS) expect(card(puzzle)).toHaveProperty('disabled', false)
    // The gallery's first render solves every curated level (~2s locally,
    // cached for the tests after it), so give it headroom on slower CI runners.
  }, 20_000)

  it("shows each level's assessed score on its card", () => {
    render(<LevelGallery />)
    const first = levelWhere(() => true)
    expect(card(first).textContent).toContain(`score ${String(assessDifficulty(first).score)}`)
  })

  it('a Legendary level is clickable too — nothing is locked', () => {
    render(<LevelGallery />)
    expect(card(levelWhere((p) => p.difficulty === 'legendary'))).toHaveProperty('disabled', false)
  })

  it('clicking a level opens it for play, and Back returns to the list', () => {
    render(<LevelGallery />)
    const level = levelWhere(() => true)
    fireEvent.click(card(level))
    expect(screen.getByText(`0 / ${String(level.dots.length)} dots connected`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to All Levels' }))
    expect(screen.getByText(`Dev QA — every level unlocked (${String(ALL_LEVELS.length)} total)`)).toBeTruthy()
  })
})
