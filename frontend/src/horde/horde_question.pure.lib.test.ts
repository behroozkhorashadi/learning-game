import { describe, expect, it } from 'vitest'
import { hordeItem } from './horde_fakes.test.ui.tsx'
import { HORDE_GAME_ID, hordeQuestion, travelMsFor } from './horde_question.pure.lib.ts'

describe('hordeQuestion', () => {
  it('reads a fact into the question, its summary, and its answers', () => {
    const question = hordeQuestion(hordeItem(0, 9000))
    expect(question).toEqual({
      id: 'horde-0',
      text: '3 + 4 =',
      summary: '3 + 4 = 7',
      options: [
        { label: '6', correct: false },
        { label: '7', correct: true },
        { label: '8', correct: false },
        { label: '5', correct: false },
      ],
    })
  })

  it("sets the crossing time from the item's pace", () => {
    expect(travelMsFor(hordeItem(0, 9000))).toBe(54_000)
  })

  it("throws on a payload that isn't a fact", () => {
    const item = { ...hordeItem(0, 9000), payload: { word: 'cat' } }
    expect(() => hordeQuestion(item)).toThrow("Item horde-0 isn't an arithmetic fact")
    expect(() => travelMsFor(item)).toThrow("isn't an arithmetic fact")
  })

  it('asks the server for the horde game', () => {
    expect(HORDE_GAME_ID).toBe('zombie_horde')
  })
})
