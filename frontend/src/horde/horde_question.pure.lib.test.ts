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

  it('reads a solve-for-x item: the zombie carrying x is the right one', () => {
    const item = { ...hordeItem(0, 4500), level: 11, payload: { left: 9, operator: '-', right: 4, answer: 5, missing: 'right', options: [3, 4, 5, 6], approach_ms: 4500 } }
    const question = hordeQuestion(item)
    expect([question.text, question.summary]).toEqual(['If 9 - x = 5, x =', '9 - x = 5, so x = 4'])
    expect(question.options.filter((option) => option.correct)).toEqual([{ label: '4', correct: true }])
  })

  it('walks a little faster at higher levels, whatever the item says about its pace', () => {
    expect(travelMsFor({ ...hordeItem(0, 9000), level: 1 })).toBe(54_000)
    expect(travelMsFor({ ...hordeItem(0, 4500), level: 10 })).toBe(45_000)
    expect(travelMsFor({ ...hordeItem(0, 4500), level: 12 })).toBe(45_000)
    expect(travelMsFor({ ...hordeItem(0, 4500), level: 99 })).toBe(45_000)
  })

  it("throws on a payload that isn't a fact", () => {
    const item = { ...hordeItem(0, 9000), payload: { word: 'cat' } }
    expect(() => hordeQuestion(item)).toThrow("Item horde-0 isn't an arithmetic fact")
  })

  it('asks the server for the horde game', () => {
    expect(HORDE_GAME_ID).toBe('zombie_horde')
  })
})
