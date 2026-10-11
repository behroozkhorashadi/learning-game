import { describe, expect, it } from 'vitest'
import { CARDS, cardById, cardsIn, drawCard } from './modifier_cards.pure.lib.ts'

describe('modifier cards', () => {
  it('has nine cards in three tiers', () => {
    expect(CARDS).toHaveLength(9)
    expect(['warm', 'twist', 'tricky'].map((t) => cardsIn(t === 'warm' ? 'warm' : t === 'twist' ? 'twist' : 'tricky').length)).toEqual([3, 3, 3])
  })

  it('draws by the random source and looks cards up by id', () => {
    const twists = cardsIn('twist')
    expect(drawCard(twists, () => 0)).toBe(twists[0])
    expect(drawCard(twists, () => 0.99)).toBe(twists[2])
    expect(drawCard([], () => 0.5)).toBe(CARDS[0])
    expect(cardById('nope')).toBe(CARDS[0])
  })
})
