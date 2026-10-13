import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { ArmoryShop, type ArmoryShopProps } from './armory_shop.pure.ui.tsx'
import { fakeArmory } from './horde_fakes.test.ui.tsx'

afterEach(cleanup)

const STARTER = { weaponId: 'starter_blaster', bulletId: 'standard_rounds' }

function props(overrides: Partial<ArmoryShopProps> = {}): ArmoryShopProps {
  return { armory: loaded(fakeArmory({ balance: 260 }).state()), choice: STARTER, onChoose: vi.fn(), onBuy: vi.fn(), buying: null, bought: null, buyError: null, skinId: 'steel_suit', onWear: vi.fn(), ...overrides }
}

describe('ArmoryShop', () => {
  it('shows what each piece of gear does', () => {
    render(<ArmoryShop {...props()} />)
    const blasters = within(screen.getByRole('list', { name: 'Blasters' }))
    expect(blasters.getByText('Reload 0.70s · Head 2 hits · Body 4 hits · Leg 5 hits')).toBeTruthy()
    const rounds = within(screen.getByRole('list', { name: 'Rounds' }))
    expect(rounds.getByText('Head 2 hits · Body 3 hits · Leg 4 hits')).toBeTruthy()
    expect(rounds.getByText('Head 2 hits · Body 3 hits · Leg 3 hits')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Grenades' })).getByText(/3 grenades/)).toBeTruthy()
  })

  it('buys what it can afford', () => {
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onBuy })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy Rapid Blaster for 250 points' }))
    expect(onBuy).toHaveBeenCalledWith('rapid_blaster')
  })

  it('says what was just bought on its card, and how many grenades there are', () => {
    render(<ArmoryShop {...props({ bought: 'grenade_pack', armory: loaded(fakeArmory({ balance: 260, grenades: 4 }).state()) })} />)
    const grenades = within(screen.getByRole('list', { name: 'Grenades' }))
    expect(grenades.getByRole('status').textContent).toBe('✓ Bought 3 grenades!')
    expect(grenades.getByText('You have 4')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Rounds' })).queryByRole('status')).toBeNull()
    cleanup()
    render(<ArmoryShop {...props({ bought: 'armor_piercing' })} />)
    expect(within(screen.getByRole('list', { name: 'Rounds' })).getByRole('status').textContent).toBe('✓ Bought 25 rounds!')
    cleanup()
    render(<ArmoryShop {...props({ bought: 'rapid_blaster', armory: loaded(fakeArmory({ balance: 10, owned: ['rapid_blaster'] }).state()) })} />)
    expect(within(screen.getByRole('list', { name: 'Blasters' })).getByRole('status').textContent).toBe('✓ Bought! Equip it to use it.')
  })

  it("doesn't buy what it can't afford, or while another purchase is in flight", () => {
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onBuy, armory: loaded(fakeArmory({ balance: 10 }).state()) })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy Grenade Pack for 80 points' }))
    cleanup()
    render(<ArmoryShop {...props({ onBuy, buying: 'armor_piercing' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy Grenade Pack for 80 points' }))
    expect(onBuy).not.toHaveBeenCalled()
  })

  it('loads special rounds it has, shows how many are left, and sells more', () => {
    const onChoose = vi.fn()
    render(<ArmoryShop {...props({ onChoose, armory: loaded(fakeArmory({ balance: 100, ammo: { armor_piercing: 12 } }).state()) })} />)
    const rounds = within(screen.getByRole('list', { name: 'Rounds' }))
    expect(rounds.getByText('12 left')).toBeTruthy()
    expect(rounds.getByText('none left')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load Armor-Piercing Rounds' }))
    expect(onChoose).toHaveBeenCalledWith({ weaponId: 'starter_blaster', bulletId: 'armor_piercing' })
    expect(screen.getByRole('button', { name: 'Buy Armor-Piercing Rounds for 60 points' })).toBeTruthy()
    // None left: nothing to load, only to buy.
    expect(screen.queryByRole('button', { name: 'Load Explosive Rounds' })).toBeNull()
  })

  it('sells armor gems, says what each does, and how many charges are on the armor', () => {
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onBuy, armory: loaded(fakeArmory({ balance: 260, gems: { reflect_gem: 4 } }).state()) })} />)
    const gems = within(screen.getByRole('list', { name: 'Armor gems' }))
    expect(gems.getByText('Reflects 2 throws. Gems stack: two give 4.')).toBeTruthy()
    expect(gems.getByText('Blocks 2 zombies: half a heart instead of a whole one, and it flies back.')).toBeTruthy()
    expect(gems.getByText('2 charges, each a reflect or a block, whichever you need first.')).toBeTruthy()
    expect(gems.getByText('4 charges on your armor')).toBeTruthy()
    expect(gems.getAllByText('none yet')).toHaveLength(3)
    // Gems stack: one already on the armor can be bought again.
    fireEvent.click(gems.getByRole('button', { name: 'Buy Reflect Gem for 60 points' }))
    expect(onBuy).toHaveBeenCalledWith('reflect_gem')
    expect(gems.queryByRole('button', { name: /^(Equip|Load)/ })).toBeNull()
  })

  it('sells Thorns Plating once, then it is always on', () => {
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onBuy, armory: loaded(fakeArmory({ balance: 300 }).state()) })} />)
    const upgrades = within(screen.getByRole('list', { name: 'Armor upgrades' }))
    expect(upgrades.getByText('Blocked zombies take 25 damage. You still need the math to finish them.')).toBeTruthy()
    fireEvent.click(upgrades.getByRole('button', { name: 'Buy Thorns Plating for 250 points' }))
    expect(onBuy).toHaveBeenCalledWith('thorns_plating')
    cleanup()
    render(<ArmoryShop {...props({ armory: loaded(fakeArmory({ owned: ['thorns_plating'] }).state()) })} />)
    const owned = within(screen.getByRole('list', { name: 'Armor upgrades' }))
    expect(owned.getByText('Always on')).toBeTruthy()
    expect(owned.queryByRole('button')).toBeNull()
  })

  it('wears an owned skin, and sells the rest once each', () => {
    const onWear = vi.fn()
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onWear, onBuy, skinId: 'steel_suit', armory: loaded(fakeArmory({ balance: 150, owned: ['jungle_camo'] }).state()) })} />)
    const skins = within(screen.getByRole('list', { name: 'Armor skins' }))
    expect(skins.getByText('Wearing')).toBeTruthy()
    fireEvent.click(skins.getByRole('button', { name: 'Wear Jungle Camo' }))
    expect(onWear).toHaveBeenCalledWith('jungle_camo')
    fireEvent.click(skins.getByRole('button', { name: 'Buy Galaxy Suit for 200 points' }))
    expect(onBuy).not.toHaveBeenCalled()
    expect(skins.queryByRole('button', { name: /Buy (Steel Suit|Jungle Camo)/ })).toBeNull()
  })

  it('says a gem just bought is on the armor', () => {
    render(<ArmoryShop {...props({ bought: 'block_gem', armory: loaded(fakeArmory({ balance: 260, gems: { block_gem: 2 } }).state()) })} />)
    expect(within(screen.getByRole('list', { name: 'Armor gems' })).getByRole('status').textContent).toBe("✓ Bought! It's on your armor for the next round.")
  })

  it('shows loading, a failed load, and a refused purchase', () => {
    render(<ArmoryShop {...props({ armory: LOADING })} />)
    expect(screen.getByText('Opening the armory…')).toBeTruthy()
    cleanup()
    render(<ArmoryShop {...props({ armory: failed('HTTP 500') })} />)
    expect(screen.getByRole('alert').textContent).toContain('starter blaster')
    cleanup()
    render(<ArmoryShop {...props({ buyError: 'too expensive' })} />)
    expect(screen.getByRole('alert').textContent).toBe('too expensive')
  })
})
