import { describe, expect, it } from 'vitest'
import { isIllustrationStyle, styleLabel, swatchOf } from './illustration_style.pure.lib.ts'

describe('illustration styles', () => {
  it('names and colours each style', () => {
    expect(styleLabel('inkwash')).toBe('Ink & wash')
    expect(swatchOf('chalk')).toContain('#3B4152')
    expect([isIllustrationStyle('chalk'), isIllustrationStyle('crayon'), isIllustrationStyle(null)]).toEqual([true, false, false])
  })
})
