import { describe, expect, it } from 'vitest'
import { coachQuestions, forgedIngredients, pieceTitleOf } from './forge_recipe.pure.lib.ts'

describe('forge recipe', () => {
  it('needs all four picks, and titles the piece from character and setting', () => {
    expect(forgedIngredients({ character: 0 })).toBeNull()
    const picks = { character: 2, setting: 1, object: 0, mood: 2 }
    expect(forgedIngredients(picks)).toEqual({ character: 'a talking crow', setting: 'the last night bus', object: 'a jar of oil', mood: 'stupidly brave' })
    expect([pieceTitleOf(picks), pieceTitleOf({})]).toEqual(['A talking crow, the last night bus', 'Your story'])
  })

  it('asks about this forge, answered once anything changed', () => {
    const ingredients = { character: 'a crow', setting: 'a bus', object: 'a map', mood: 'uneasy' }
    const qs = coachQuestions(ingredients, false)
    expect(qs.map((q) => q.text)).toEqual(['How does a crow first notice a map?', 'Is there a word you used more than once? Try swapping one out.', 'Where does it feel most uneasy?'])
    expect(coachQuestions(ingredients, true).every((q) => q.answered === true)).toBe(true)
  })
})
