import { describe, it, expect } from 'vitest'
import { resolveZombieClip } from './zombieAnimationFallback'

describe('resolveZombieClip', () => {
  it('uses the configured clip when it exists, and reports no fallback', () => {
    const result = resolveZombieClip('Mummy_Stagger', 'approach', ['Mummy_Stagger', 'Dead'])
    expect(result).toEqual({ clipName: 'Mummy_Stagger', usedFallback: false })
  })

  it('falls back to the first available clip when idle is missing', () => {
    const result = resolveZombieClip('Happy_Sway_Standing', 'idle', ['Walking', 'Dead'])
    expect(result).toEqual({ clipName: 'Walking', usedFallback: true })
  })

  it('falls back to the first available clip when approach is missing', () => {
    const result = resolveZombieClip('Mummy_Stagger', 'approach', ['Running'])
    expect(result).toEqual({ clipName: 'Running', usedFallback: true })
  })

  it('falls back to a stationary pose (null) rather than an unrelated one-shot clip for a missing hit reaction', () => {
    const result = resolveZombieClip('Hit_Reaction', 'hitReact', ['Walking', 'Running'])
    expect(result).toEqual({ clipName: null, usedFallback: true })
  })

  it('falls back to a stationary pose (null) for a missing headshot death clip', () => {
    const result = resolveZombieClip('Dead', 'deadHeadshot', ['Walking'])
    expect(result).toEqual({ clipName: null, usedFallback: true })
  })

  it('falls back to a stationary pose (null) for a missing body-defeat clip', () => {
    const result = resolveZombieClip('dying_backwards', 'deadBody', ['Walking'])
    expect(result).toEqual({ clipName: null, usedFallback: true })
  })

  it('falls back to a stationary pose (null) for a missing attack/reach clip', () => {
    const result = resolveZombieClip('Right_Hand_Sword_Slash', 'reach', ['Walking'])
    expect(result).toEqual({ clipName: null, usedFallback: true })
  })

  it('falls back to a stationary pose (null) when the GLB has no animations at all', () => {
    const result = resolveZombieClip('Happy_Sway_Standing', 'idle', [])
    expect(result).toEqual({ clipName: null, usedFallback: true })
  })

  it('does not crash or throw for any role when everything is missing', () => {
    const roles = ['idle', 'approach', 'hitReact', 'deadHeadshot', 'deadBody', 'reach'] as const
    for (const role of roles) {
      expect(() => resolveZombieClip('NotReal', role, [])).not.toThrow()
    }
  })
})
