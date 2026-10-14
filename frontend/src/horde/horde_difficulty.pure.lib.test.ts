import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, EASY, HARD, INSANE, MEDIUM, difficultyById } from './horde_difficulty.pure.lib.ts'

describe('horde difficulty', () => {
  it('gets harder in order: faster zombies and fewer points', () => {
    expect(DIFFICULTIES.map((difficulty) => difficulty.id)).toEqual(['easy', 'medium', 'hard', 'insane'])
    expect(EASY.travelScale).toBeGreaterThan(MEDIUM.travelScale)
    expect(MEDIUM.travelScale).toBeGreaterThan(HARD.travelScale)
    expect(EASY.pointsScale).toBeGreaterThan(MEDIUM.pointsScale)
    expect(MEDIUM.pointsScale).toBeGreaterThan(HARD.pointsScale)
  })

  it('insane uses hard tuning and relies on its locked loadout for the extra challenge', () => {
    expect(INSANE.travelScale).toBe(HARD.travelScale)
    expect(INSANE.pointsScale).toBe(HARD.pointsScale)
  })

  it('medium walks at the tuned speed', () => {
    expect(MEDIUM.travelScale).toBe(1)
  })

  it('finds each difficulty by id', () => {
    expect(difficultyById('hard')).toBe(HARD)
    expect(difficultyById('insane')).toBe(INSANE)
    expect(difficultyById('easy')).toBe(EASY)
  })
})
