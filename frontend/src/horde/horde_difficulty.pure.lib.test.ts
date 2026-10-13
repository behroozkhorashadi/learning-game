import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, EASY, HARD, MEDIUM, difficultyById } from './horde_difficulty.pure.lib.ts'

describe('horde difficulty', () => {
  it('gets harder in order: faster zombies and fewer points', () => {
    expect(DIFFICULTIES.map((difficulty) => difficulty.id)).toEqual(['easy', 'medium', 'hard'])
    expect(EASY.travelScale).toBeGreaterThan(MEDIUM.travelScale)
    expect(MEDIUM.travelScale).toBeGreaterThan(HARD.travelScale)
    expect(EASY.pointsScale).toBeGreaterThan(MEDIUM.pointsScale)
    expect(MEDIUM.pointsScale).toBeGreaterThan(HARD.pointsScale)
  })

  it('medium walks at the tuned speed', () => {
    expect(MEDIUM.travelScale).toBe(1)
  })

  it('finds each difficulty by id', () => {
    expect(difficultyById('hard')).toBe(HARD)
    expect(difficultyById('easy')).toBe(EASY)
  })
})
