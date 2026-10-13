import { describe, expect, it } from 'vitest'
import { armoryStateSchema } from './armory_schema.pure.lib.ts'

const STATE = {
  profile_id: 1,
  balance: 50,
  earned: 50,
  spent: 0,
  owned: ['starter_blaster'],
  grenades: 1,
  ammo: { armor_piercing: 0 },
  gems: { reflect_gem: 2 },
  best_survived_ms: { easy: 0, medium: 0, hard: 0 },
  catalog: [{ id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades.', price: 80, quantity: 3, consumable: true, requires: null }],
}

describe('armoryStateSchema', () => {
  it('accepts a state from the server', () => {
    expect(armoryStateSchema.parse(STATE)).toEqual(STATE)
  })

  it('accepts armor gems and their charges', () => {
    const gem = { id: 'mega_gem', kind: 'gem', name: 'Mega Gem', description: 'Does both.', price: 150, quantity: 2, consumable: true, requires: null }
    expect(armoryStateSchema.parse({ ...STATE, gems: { mega_gem: 2 }, catalog: [gem] }).gems).toEqual({ mega_gem: 2 })
  })

  it('rejects a state without gem charges', () => {
    const { gems: _gems, ...old } = STATE
    expect(armoryStateSchema.safeParse(old).success).toBe(false)
  })

  it('rejects an item kind the game does not know', () => {
    expect(armoryStateSchema.safeParse({ ...STATE, catalog: [{ ...STATE.catalog[0], kind: 'laser' }] }).success).toBe(false)
  })

  it('rejects a fractional balance', () => {
    expect(armoryStateSchema.safeParse({ ...STATE, balance: 1.5 }).success).toBe(false)
  })
})
