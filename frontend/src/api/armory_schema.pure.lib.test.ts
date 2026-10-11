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
  catalog: [{ id: 'grenade_pack', kind: 'grenade', name: 'Grenade Pack', description: 'Three grenades.', price: 80, quantity: 3, consumable: true, requires: null }],
}

describe('armoryStateSchema', () => {
  it('accepts a state from the server', () => {
    expect(armoryStateSchema.parse(STATE)).toEqual(STATE)
  })

  it('rejects an item kind the game does not know', () => {
    expect(armoryStateSchema.safeParse({ ...STATE, catalog: [{ ...STATE.catalog[0], kind: 'laser' }] }).success).toBe(false)
  })

  it('rejects a fractional balance', () => {
    expect(armoryStateSchema.safeParse({ ...STATE, balance: 1.5 }).success).toBe(false)
  })
})
