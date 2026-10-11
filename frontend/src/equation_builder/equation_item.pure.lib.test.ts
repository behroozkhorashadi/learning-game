import { describe, expect, it } from 'vitest'
import { EQUATION_CONFIG, equationBoard, equationText, parseEquationPayload, partLabel } from './equation_item.pure.lib.ts'

describe('equation items', () => {
  it('builds a one-slot board whose answer is the missing part', () => {
    const p = parseEquationPayload({ left: 3, operator: '+', right: 4, answer: 7, missing: 'operator', tiles: ['+', '-'] })
    expect(equationBoard(p)).toMatchObject({ kind: 'equation', slots: 1, answer: ['+'], spoken: '+', tiles: [{ id: '+-0' }, { id: '--1' }] })
    expect([partLabel(p, 'left'), equationText(p)]).toEqual(['3', '3 + 4 = 7'])
    expect(EQUATION_CONFIG.details(p, ['+-0'])).toEqual({ placement: ['+-0'], missing: 'operator' })
  })

  it('rejects an unknown missing part', () => {
    expect(() => parseEquationPayload({ left: 1, operator: '+', right: 1, answer: 2, missing: 'nope', tiles: [] })).toThrow('unexpected payload')
  })
})
