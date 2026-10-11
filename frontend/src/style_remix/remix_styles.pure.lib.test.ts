import { describe, expect, it } from 'vitest'
import { STYLES, coachQuestions, drawStyle } from './remix_styles.pure.lib.ts'

describe('remix styles', () => {
  it('draws only unused styles until all are used', () => {
    expect(drawStyle([], () => 0).key).toBe('spooky')
    expect(drawStyle(['spooky'], () => 0).key).toBe('news')
    expect(drawStyle(STYLES.map((s) => s.key), () => 0).key).toBe('spooky')
  })

  it('asks about the favourite style', () => {
    expect(coachQuestions('Fairy Tale', true)[2]).toMatchObject({ text: 'Where does this feel most like Fairy Tale?', answered: true })
    expect(coachQuestions(null, false)[2]?.text).toBe('Where does this feel most like your style?')
  })
})
