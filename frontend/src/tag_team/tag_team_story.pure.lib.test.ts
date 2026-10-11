import { describe, expect, it } from 'vitest'
import { GENRE_VARIANTS, aiLine, chooseStory, nextTurn, wordShare } from './tag_team_story.pure.lib.ts'

describe('tag-team story rules', () => {
  it('picks a whole variant, resolving "surprise" to a real genre', () => {
    expect(chooseStory('silly', () => 0).variant).toBe(GENRE_VARIANTS.silly[0])
    expect(chooseStory('surprise', () => 0.99).genre).toBe('silly')
  })

  it('alternates turns, AI first, until the level', () => {
    expect([0, 1, 2, 3, 4].map((n) => nextTurn(n, 4))).toEqual(['ai', 'kid', 'ai', 'kid', 'done'])
  })

  it("gives the AI its lines in order, repeating the last if it runs out", () => {
    const v = GENRE_VARIANTS.ghost[0]
    expect(aiLine(v, 2)).toBe(v.lines[1])
    expect(aiLine(v, 40)).toBe(v.lines[v.lines.length - 1])
  })

  it('counts each side’s share of the words', () => {
    expect(wordShare([{ author: 'ai', text: 'one two three' }, { author: 'kid', text: 'four' }])).toEqual({ kidWords: 1, aiWords: 3, kidPct: 25, aiPct: 75 })
    expect(wordShare([])).toEqual({ kidWords: 0, aiWords: 0, kidPct: 0, aiPct: 0 })
  })
})
