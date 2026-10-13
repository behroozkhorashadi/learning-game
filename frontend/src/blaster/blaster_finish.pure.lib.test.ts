import { describe, expect, it } from 'vitest'
import { FINISH_LOOKS, glowAt } from './blaster_finish.pure.lib.ts'

describe('blaster finishes', () => {
  it('leaves the classic blaster as the model draws it', () => {
    expect(FINISH_LOOKS.classic.tint).toBeNull()
    expect(FINISH_LOOKS.classic.parts).toEqual([])
    expect(FINISH_LOOKS.classic.flashScale).toBe(1)
  })

  it('gets louder with each better blaster: more parts, more glow, a bigger flash', () => {
    const { classic, rapid, mega } = FINISH_LOOKS
    expect(rapid.parts.length).toBeGreaterThan(classic.parts.length)
    expect(mega.parts.length).toBeGreaterThan(rapid.parts.length)
    expect(mega.glowIntensity).toBeGreaterThan(rapid.glowIntensity)
    expect(mega.flashScale).toBeGreaterThan(rapid.flashScale)
    expect(rapid.flashScale).toBeGreaterThan(classic.flashScale)
  })

  it('keeps every part on the blaster, not floating away from it', () => {
    for (const look of Object.values(FINISH_LOOKS)) {
      for (const part of look.parts) {
        const [x, y, z] = part.position
        expect(Math.abs(x)).toBeLessThanOrEqual(0.5)
        expect(Math.abs(y)).toBeLessThanOrEqual(0.3)
        expect(Math.abs(z)).toBeLessThanOrEqual(0.12)
      }
    }
  })

  it('pulses the glow around its intensity', () => {
    const { mega } = FINISH_LOOKS
    const samples = Array.from({ length: 40 }, (_, i) => glowAt(mega, i / 10))
    expect(Math.max(...samples)).toBeGreaterThan(mega.glowIntensity)
    expect(Math.min(...samples)).toBeLessThan(mega.glowIntensity)
    expect(Math.min(...samples)).toBeGreaterThan(0)
  })
})
