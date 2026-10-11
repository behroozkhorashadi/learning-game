import { describe, expect, it } from 'vitest'
import { BULLETS, STARTER_LOADOUT, WEAPONS, bestOwned, hitsToDefeat, loadoutFor, shotPower } from './horde_armory.pure.lib.ts'

const STARTER = ['starter_blaster', 'standard_rounds']

describe('horde armory', () => {
  it('the starter loadout is 1 hit to the head, 2 to the body, 3 to a leg', () => {
    const power = shotPower(STARTER_LOADOUT)
    expect([hitsToDefeat(power, 'head'), hitsToDefeat(power, 'body'), hitsToDefeat(power, 'leg')]).toEqual([1, 2, 3])
  })

  it('every upgrade hits at least as hard, and faster weapons reload faster', () => {
    for (let i = 1; i < WEAPONS.length; i++) {
      expect(WEAPONS[i]?.damageScale).toBeGreaterThan(WEAPONS[i - 1]?.damageScale ?? Infinity)
      expect(WEAPONS[i]?.cooldownMs).toBeLessThan(WEAPONS[i - 1]?.cooldownMs ?? 0)
    }
    for (let i = 1; i < BULLETS.length; i++) {
      for (const zone of ['head', 'body', 'leg'] as const) expect(BULLETS[i]?.power[zone]).toBeGreaterThanOrEqual(BULLETS[i - 1]?.power[zone] ?? Infinity)
    }
  })

  it('the best gear makes a body shot a one-hit defeat', () => {
    const owned = [...STARTER, 'rapid_blaster', 'mega_blaster', 'armor_piercing', 'explosive_rounds']
    const { weaponId, bulletId } = bestOwned(owned)
    expect([weaponId, bulletId]).toEqual(['mega_blaster', 'explosive_rounds'])
    expect(hitsToDefeat(shotPower(loadoutFor(weaponId, bulletId, owned)), 'body')).toBe(1)
  })

  it('falls back to the starter for anything not owned or unknown', () => {
    expect(loadoutFor('mega_blaster', 'laser_beams', STARTER)).toEqual(STARTER_LOADOUT)
    expect(bestOwned([])).toEqual({ weaponId: 'starter_blaster', bulletId: 'standard_rounds' })
  })
})
