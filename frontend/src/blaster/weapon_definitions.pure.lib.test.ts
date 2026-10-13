import { describe, expect, it } from 'vitest'
import { DEFAULT_WEAPON_ID, MEGA_BLASTER, RAPID_BLASTER, STARTER_BLASTER, WEAPON_DEFINITIONS, weaponDefinitionFor } from './weapon_definitions.pure.lib.ts'

describe('weapon definitions', () => {
  it('starts with the starter blaster, unlocked', () => {
    expect(WEAPON_DEFINITIONS[DEFAULT_WEAPON_ID]).toBe(STARTER_BLASTER)
    expect(STARTER_BLASTER.unlockedByDefault).toBe(true)
  })

  it('cocks for longer than its recoil, so the reload starts after the kick', () => {
    expect(STARTER_BLASTER.cockingMs).toBeGreaterThan(STARTER_BLASTER.recoilDurationMs)
  })

  it('looks better with each better blaster, and finds each by id', () => {
    expect([STARTER_BLASTER, RAPID_BLASTER, MEGA_BLASTER].map((w) => w.finish)).toEqual(['classic', 'rapid', 'mega'])
    expect(weaponDefinitionFor('mega_blaster')).toBe(MEGA_BLASTER)
    expect(weaponDefinitionFor('rapid_blaster')).toBe(RAPID_BLASTER)
    expect(weaponDefinitionFor('laser_cannon')).toBe(STARTER_BLASTER)
  })

  it('every blaster cocks for longer than its recoil', () => {
    for (const weapon of Object.values(WEAPON_DEFINITIONS)) expect(weapon.cockingMs).toBeGreaterThan(weapon.recoilDurationMs)
  })
})
