import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PathfinderLevelGallery } from './PathfinderLevelGallery'
import { ALL_LEVELS } from '../lib/pathfinderLevels'
import { assessDifficulty } from '../lib/pathfinderDifficulty'

afterEach(cleanup)

describe('PathfinderLevelGallery', () => {
  it('shows every curated level, unlocked, across all difficulty tiers', () => {
    render(<PathfinderLevelGallery />)
    expect(screen.getByText(`Dev QA — every level unlocked (${ALL_LEVELS.length} total)`)).toBeTruthy()
    for (const puzzle of ALL_LEVELS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${puzzle.name}$`) })).toBeTruthy()
    }
  })

  it("shows each level's assessed score on its card", () => {
    render(<PathfinderLevelGallery />)
    const first = ALL_LEVELS[0]
    const expectedScore = assessDifficulty(first).score
    const card = screen.getByRole('button', { name: new RegExp(`^${first.name}$`) })
    expect(card.textContent).toContain(`score ${expectedScore}`)
  })

  it('every level is clickable regardless of tier — nothing is locked', () => {
    render(<PathfinderLevelGallery />)
    const legendaryLevel = ALL_LEVELS.find((p) => p.difficulty === 'legendary')!
    const card = screen.getByRole('button', { name: new RegExp(`^${legendaryLevel.name}$`) })
    expect((card as HTMLButtonElement).disabled).toBe(false)
  })

  it('clicking a level opens it for play, and Back returns to the list', () => {
    render(<PathfinderLevelGallery />)
    const level = ALL_LEVELS[0]
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${level.name}$`) }))
    expect(screen.getByText(`0 / ${level.dots.length} dots connected`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to All Levels' }))
    expect(screen.getByText(`Dev QA — every level unlocked (${ALL_LEVELS.length} total)`)).toBeTruthy()
  })
})
