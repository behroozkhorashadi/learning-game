import { describe, expect, it } from 'vitest'
import { BULLETS, NO_ARMOR, STARTER_LOADOUT, STEEL_SUIT, THORNS_DAMAGE, WEAPONS, armorFrom, bestOwned, gemsUsedByItem, hitsToDefeat, loadoutFor, roundArmorFrom, shotPower, skinFor } from './horde_armory.pure.lib.ts'

const STARTER = ['starter_blaster', 'standard_rounds']

describe('horde armory', () => {
  it('the starter loadout is 2 hits to the head, 4 to the body, 5 to a leg', () => {
    const power = shotPower(STARTER_LOADOUT)
    expect([hitsToDefeat(power, 'head'), hitsToDefeat(power, 'body'), hitsToDefeat(power, 'leg')]).toEqual([2, 4, 5])
  })

  it('only the Mega Blaster with Explosive Rounds makes a headshot a one-hit defeat', () => {
    const everything = [...WEAPONS, ...BULLETS].map((item) => item.id)
    for (const weapon of WEAPONS) {
      for (const bullet of BULLETS) {
        const top = weapon.id === 'mega_blaster' && bullet.id === 'explosive_rounds'
        expect(hitsToDefeat(shotPower(loadoutFor(weapon.id, bullet.id, everything)), 'head')).toBe(top ? 1 : 2)
      }
    }
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

  it('the best gear brings a body defeat down to 2 hits and a headshot to 1', () => {
    const owned = [...STARTER, 'rapid_blaster', 'mega_blaster', 'armor_piercing', 'explosive_rounds']
    const { weaponId, bulletId } = bestOwned(owned)
    expect([weaponId, bulletId]).toEqual(['mega_blaster', 'explosive_rounds'])
    const power = shotPower(loadoutFor(weaponId, bulletId, owned))
    expect([hitsToDefeat(power, 'head'), hitsToDefeat(power, 'body')]).toEqual([1, 2])
  })

  it('each weapon upgrade with Explosive Rounds takes fewer hits somewhere', () => {
    const everything = [...WEAPONS, ...BULLETS].map((item) => item.id)
    const counts = WEAPONS.map((weapon) => {
      const power = shotPower(loadoutFor(weapon.id, 'explosive_rounds', everything))
      return [hitsToDefeat(power, 'head'), hitsToDefeat(power, 'body'), hitsToDefeat(power, 'leg')]
    })
    expect(counts).toEqual([
      [2, 3, 3],
      [2, 2, 3],
      [1, 2, 3],
    ])
  })

  it('falls back to the starter for anything not owned or unknown', () => {
    expect(loadoutFor('mega_blaster', 'laser_beams', STARTER)).toEqual(STARTER_LOADOUT)
    expect(bestOwned([])).toEqual({ weaponId: 'starter_blaster', bulletId: 'standard_rounds' })
  })

  it('wears every gem charge owned, by kind, ignoring gems it does not know', () => {
    expect(armorFrom({})).toEqual(NO_ARMOR)
    expect(armorFrom({ reflect_gem: 4, block_gem: 0, mega_gem: 2, laser_gem: 9 })).toEqual({ reflect: 4, block: 0, mega: 2, heal: 0 })
  })

  it('wears thorns only once Thorns Plating is owned, with every gem charge', () => {
    expect(roundArmorFrom({ heal_gem: 2 }, STARTER)).toEqual({ charges: { ...NO_ARMOR, heal: 2 }, thornsDamage: 0 })
    expect(roundArmorFrom({}, [...STARTER, 'thorns_plating']).thornsDamage).toBe(THORNS_DAMAGE)
  })

  it('wears the chosen skin if owned, else the fanciest owned, else steel', () => {
    expect(skinFor(null, STARTER)).toBe(STEEL_SUIT)
    expect(skinFor(null, ['steel_suit', 'jungle_camo', 'gold_suit']).id).toBe('gold_suit')
    expect(skinFor('jungle_camo', ['steel_suit', 'jungle_camo', 'gold_suit']).id).toBe('jungle_camo')
    expect(skinFor('gold_suit', ['steel_suit', 'jungle_camo']).id).toBe('jungle_camo')
    expect(STEEL_SUIT.tint).toBeNull()
  })

  it('reports the charges a round used by gem item id, leaving out the unused', () => {
    expect(gemsUsedByItem(NO_ARMOR)).toEqual({})
    expect(gemsUsedByItem({ reflect: 3, block: 0, mega: 1, heal: 0 })).toEqual({ reflect_gem: 3, mega_gem: 1 })
  })
})
