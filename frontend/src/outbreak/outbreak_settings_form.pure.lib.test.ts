import { describe, expect, it } from 'vitest'
import { difficultyLabel, draftFrom, settingsSave, toggleFocusNumber, toggleOperation } from './outbreak_settings_form.pure.lib.ts'

const DEFAULTS = draftFrom(null)

describe('outbreak settings form', () => {
  it('defaults to automatic, every operation, mid difficulty', () => {
    expect(DEFAULTS).toEqual({ custom: false, operations: ['+', '-', '×', '÷'], focusNumbers: {}, difficulty: 5 })
  })

  it('reads a saved config as customized', () => {
    expect(draftFrom({ profile_id: 1, game_id: 'fact_fluency', operations: ['×'], focus_numbers: { '×': [7] }, difficulty: 8 })).toEqual({ custom: true, operations: ['×'], focusNumbers: { '×': [7] }, difficulty: 8 })
  })

  it('toggles operations in order and never removes the last one', () => {
    const one = toggleOperation(toggleOperation(toggleOperation(DEFAULTS, '+'), '-'), '÷')
    expect(one.operations).toEqual(['×'])
    expect(toggleOperation(one, '×')).toBe(one)
    expect(toggleOperation(one, '+').operations).toEqual(['+', '×'])
  })

  it('toggles focus numbers per operation', () => {
    const on = toggleFocusNumber(toggleFocusNumber(DEFAULTS, '×', 7), '×', 8)
    expect(on.focusNumbers).toEqual({ '×': [7, 8] })
    expect(toggleFocusNumber(on, '×', 7).focusNumbers).toEqual({ '×': [8] })
  })

  it('saves custom settings, clears ones turned off, and does nothing otherwise', () => {
    expect(settingsSave({ ...DEFAULTS, custom: true }, false, 2, 'fact_fluency')).toEqual({ kind: 'save', config: { profile_id: 2, game_id: 'fact_fluency', operations: DEFAULTS.operations, focus_numbers: {}, difficulty: 5 } })
    expect(settingsSave(DEFAULTS, true, 2, 'fact_fluency')).toEqual({ kind: 'clear' })
    expect(settingsSave(DEFAULTS, false, 2, 'fact_fluency')).toEqual({ kind: 'none' })
  })

  it('names the difficulty bands', () => {
    expect([1, 3, 6, 9, 11].map(difficultyLabel)).toEqual(['Warm-up', 'Building confidence', 'Steady challenge', 'Advanced', 'Solve for x'])
  })
})
