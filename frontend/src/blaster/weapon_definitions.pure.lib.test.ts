import { describe, expect, it } from 'vitest'
import { DEFAULT_WEAPON_ID, STARTER_BLASTER, WEAPON_DEFINITIONS } from './weapon_definitions.pure.lib.ts'

describe('weapon definitions', () => {
  it('starts with the starter blaster, unlocked', () => {
    expect(WEAPON_DEFINITIONS[DEFAULT_WEAPON_ID]).toBe(STARTER_BLASTER)
    expect(STARTER_BLASTER.unlockedByDefault).toBe(true)
  })

  it('cocks for longer than its recoil, so the reload starts after the kick', () => {
    expect(STARTER_BLASTER.cockingMs).toBeGreaterThan(STARTER_BLASTER.recoilDurationMs)
  })
})
