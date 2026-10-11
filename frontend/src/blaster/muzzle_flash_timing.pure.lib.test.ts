import { describe, it, expect } from 'vitest'
import { easeOutQuad, computeMuzzleFlashState, computeSparkState, computeMuzzleLightIntensity, flashTexturePixels, rollMuzzleShot, seededRandom, sparkTexturePixels } from './muzzle_flash_timing.pure.lib.ts'

/**
 * Unit tests for `MuzzleFlash`'s pure timing/easing math — no Three.js
 * scene graph, no canvas, so these run without a WebGL context. The visual
 * correctness (does it actually look like a star-shaped flash) can't be
 * asserted in jsdom; what *can* be pinned down here is the contract every
 * caller relies on: each effect is fully off before/after its own window,
 * and never drifts or lingers.
 */

/** Fails the test if a state that should exist is null. */
function defined<T>(value: T | null): T {
  if (value === null) throw new Error('expected a value inside the lifetime window')
  return value
}

describe('easeOutQuad', () => {
  it('starts at 0 and ends at 1', () => {
    expect(easeOutQuad(0)).toBe(0)
    expect(easeOutQuad(1)).toBe(1)
  })

  it('is monotonically non-decreasing', () => {
    let prev = -Infinity
    for (let t = 0; t <= 1; t += 0.05) {
      const value = easeOutQuad(t)
      expect(value).toBeGreaterThanOrEqual(prev)
      prev = value
    }
  })
})

describe('computeMuzzleFlashState', () => {
  const duration = 65
  const startScale = 0.14
  const endScale = 0.26

  it('is null before the flash starts and once its duration has elapsed — never lingers', () => {
    expect(computeMuzzleFlashState(-1, duration, startScale, endScale)).toBeNull()
    expect(computeMuzzleFlashState(duration + 1, duration, startScale, endScale)).toBeNull()
  })

  it('starts at the start scale, fully bright', () => {
    const state = computeMuzzleFlashState(0, duration, startScale, endScale)
    expect(state).not.toBeNull()
    expect(defined(state).scale).toBeCloseTo(startScale, 10)
    expect(defined(state).opacity).toBeCloseTo(1, 10)
  })

  it('ends at the end (expanded) scale, fully faded', () => {
    const state = computeMuzzleFlashState(duration, duration, startScale, endScale)
    expect(state).not.toBeNull()
    expect(defined(state).scale).toBeCloseTo(endScale, 10)
    expect(defined(state).opacity).toBeCloseTo(0, 10)
  })

  it('expands monotonically and fades monotonically across its lifetime', () => {
    let prevScale = -Infinity
    let prevOpacity = Infinity
    for (let t = 0; t <= duration; t += 5) {
      const state = defined(computeMuzzleFlashState(t, duration, startScale, endScale))
      expect(state.scale).toBeGreaterThanOrEqual(prevScale)
      expect(state.opacity).toBeLessThanOrEqual(prevOpacity)
      prevScale = state.scale
      prevOpacity = state.opacity
    }
  })

  it('treats a non-positive duration as already elapsed rather than dividing by zero', () => {
    expect(computeMuzzleFlashState(0, 0, startScale, endScale)).toBeNull()
  })
})

describe('computeSparkState', () => {
  const duration = 90
  const displacement: readonly [number, number, number] = [-0.06, 0.02, -0.01]

  it('is null outside its own lifetime', () => {
    expect(computeSparkState(-1, duration, displacement)).toBeNull()
    expect(computeSparkState(duration + 1, duration, displacement)).toBeNull()
  })

  it('starts at the muzzle (zero offset), fully opaque', () => {
    const state = defined(computeSparkState(0, duration, displacement))
    expect(state.position[0]).toBeCloseTo(0, 10)
    expect(state.position[1]).toBeCloseTo(0, 10)
    expect(state.position[2]).toBeCloseTo(0, 10)
    expect(state.opacity).toBeCloseTo(1, 10)
  })

  it('ends exactly at the full displacement, fully faded', () => {
    const state = defined(computeSparkState(duration, duration, displacement))
    expect(state.position[0]).toBeCloseTo(displacement[0], 10)
    expect(state.position[1]).toBeCloseTo(displacement[1], 10)
    expect(state.position[2]).toBeCloseTo(displacement[2], 10)
    expect(state.opacity).toBeCloseTo(0, 10)
  })

  it('fades linearly to exactly 0, never negative', () => {
    for (let t = 0; t <= duration; t += 10) {
      const state = defined(computeSparkState(t, duration, displacement))
      expect(state.opacity).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('computeMuzzleLightIntensity', () => {
  const duration = 40
  const peak = 3.5

  it('is exactly the peak at the very start', () => {
    expect(computeMuzzleLightIntensity(0, duration, peak)).toBeCloseTo(peak, 10)
  })

  it('is exactly 0 at the end of its window and beyond — no lingering glow', () => {
    expect(computeMuzzleLightIntensity(duration, duration, peak)).toBeCloseTo(0, 10)
    expect(computeMuzzleLightIntensity(duration + 5, duration, peak)).toBe(0)
  })

  it('is exactly 0 before the pulse starts', () => {
    expect(computeMuzzleLightIntensity(-1, duration, peak)).toBe(0)
  })

  it('fades monotonically', () => {
    let prev = Infinity
    for (let t = 0; t <= duration; t += 5) {
      const value = computeMuzzleLightIntensity(t, duration, peak)
      expect(value).toBeLessThanOrEqual(prev)
      prev = value
    }
  })
})

describe('seededRandom', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    const values = Array.from({ length: 50 }, () => a())
    expect(values).toEqual(Array.from({ length: 50 }, () => b()))
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(seededRandom(43)()).not.toBe(values[0])
  })
})

describe('rollMuzzleShot', () => {
  it('jitters size within range, sends every spark forward (-X), and shortens travel for reduced motion', () => {
    const full = rollMuzzleShot(seededRandom(1), false)
    const reduced = rollMuzzleShot(seededRandom(1), true)
    expect(full.sizeMultiplier).toBeGreaterThanOrEqual(0.85)
    expect(full.sizeMultiplier).toBeLessThanOrEqual(1.3)
    expect(full.sparkDisplacements).toHaveLength(4)
    for (const [x] of full.sparkDisplacements) expect(x).toBeLessThan(0)
    expect(Math.abs(reduced.sparkDisplacements[0]?.[0] ?? 0)).toBeCloseTo(Math.abs(full.sparkDisplacements[0]?.[0] ?? 0) * 0.6, 10)
  })
})

describe('texture pixels', () => {
  function alphaAt(pixels: Uint8Array, size: number, x: number, y: number): number {
    return pixels[(y * size + x) * 4 + 3] ?? -1
  }

  it('the flash is opaque white at the centre and fully transparent at the corners', () => {
    const size = 64
    const pixels = flashTexturePixels(size)
    expect(pixels).toHaveLength(size * size * 4)
    const centre = (32 * size + 32) * 4
    const [r = 0, g = 0, b = 0, a = 0] = Array.from(pixels.slice(centre, centre + 4))
    expect(Math.min(r, g, b)).toBeGreaterThan(240)
    expect(a).toBe(255)
    expect(alphaAt(pixels, size, 0, 0)).toBe(0)
    expect(alphaAt(pixels, size, size - 1, size - 1)).toBe(0)
  })

  it('the flash star reaches further along its points than between them', () => {
    const size = 64
    const pixels = flashTexturePixels(size)
    // Straight up from the centre is a star point; 30° off it is between two points.
    const onPoint = alphaAt(pixels, size, 32, 4)
    const betweenPoints = alphaAt(pixels, size, Math.round(32 + 28 * Math.sin(Math.PI / 6)), Math.round(32 - 28 * Math.cos(Math.PI / 6)))
    expect(onPoint).toBeGreaterThan(betweenPoints)
  })

  it('a spark is a round glow, brightest in the middle', () => {
    const size = 32
    const pixels = sparkTexturePixels(size)
    expect(alphaAt(pixels, size, 16, 16)).toBe(255)
    expect(alphaAt(pixels, size, 16, 16)).toBeGreaterThan(alphaAt(pixels, size, 16, 28))
    expect(alphaAt(pixels, size, 0, 0)).toBe(0)
  })
})
