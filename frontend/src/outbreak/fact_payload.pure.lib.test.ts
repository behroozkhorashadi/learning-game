import { describe, expect, it } from 'vitest'
import { factPayloadSchema, factSummary, factText, factValue } from './fact_payload.pure.lib.ts'

const PLAIN = { left: 3, operator: '+', right: 4, answer: 7, options: [6, 7, 8, 5], approach_ms: 8000 }

describe('fact payload', () => {
  it('reads an item from before solving for x as a plain fact', () => {
    const fact = factPayloadSchema.parse(PLAIN)
    expect(fact.missing).toBe('answer')
    expect([factText(fact), factSummary(fact), factValue(fact)]).toEqual(['3 + 4 =', '3 + 4 = 7', 7])
  })

  it('asks for x on the left', () => {
    const fact = factPayloadSchema.parse({ ...PLAIN, missing: 'left', options: [2, 3, 4, 5] })
    expect([factText(fact), factSummary(fact), factValue(fact)]).toEqual(['If x + 4 = 7, x =', 'x + 4 = 7, so x = 3', 3])
  })

  it('asks for x on the right', () => {
    const fact = factPayloadSchema.parse({ left: 20, operator: '÷', right: 4, answer: 5, missing: 'right', options: [3, 4, 5, 6], approach_ms: 4500 })
    expect([factText(fact), factSummary(fact), factValue(fact)]).toEqual(['If 20 ÷ x = 5, x =', '20 ÷ x = 5, so x = 4', 4])
  })

  it('refuses an unknown missing term', () => {
    expect(factPayloadSchema.safeParse({ ...PLAIN, missing: 'operator' }).success).toBe(false)
  })
})
