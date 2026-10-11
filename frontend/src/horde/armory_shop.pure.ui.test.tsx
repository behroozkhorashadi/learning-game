import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOADING, failed, loaded } from '@app/query/query_state.pure.lib.ts'
import { ArmoryShop, type ArmoryShopProps } from './armory_shop.pure.ui.tsx'
import { fakeArmory } from './horde_fakes.test.ui.tsx'

afterEach(cleanup)

const STARTER = { weaponId: 'starter_blaster', bulletId: 'standard_rounds' }

function props(overrides: Partial<ArmoryShopProps> = {}): ArmoryShopProps {
  return { armory: loaded(fakeArmory({ balance: 260 }).state()), choice: STARTER, onChoose: vi.fn(), onBuy: vi.fn(), buying: null, buyError: null, ...overrides }
}

describe('ArmoryShop', () => {
  it('shows what each piece of gear does', () => {
    render(<ArmoryShop {...props()} />)
    const blasters = within(screen.getByRole('list', { name: 'Blasters' }))
    expect(blasters.getByText('Reload 0.70s · Head 1 hit · Body 2 hits · Leg 3 hits')).toBeTruthy()
    const rounds = within(screen.getByRole('list', { name: 'Rounds' }))
    // Armor-piercing and explosive both take two hits to the body or a leg with the starter blaster.
    expect(rounds.getAllByText('Head 1 hit · Body 2 hits · Leg 2 hits')).toHaveLength(2)
    expect(within(screen.getByRole('list', { name: 'Grenades' })).getByText(/3 grenades/)).toBeTruthy()
  })

  it('buys what it can afford', () => {
    const onBuy = vi.fn()
    render(<ArmoryShop {...props({ onBuy })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Buy Rapid Blaster for 250 points' }))
    expect(onBuy).toHaveBeenCalledWith('rapid_blaster')
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

  it('equips owned gear', () => {
    const onChoose = vi.fn()
    render(<ArmoryShop {...props({ onChoose, armory: loaded(fakeArmory({ owned: ['armor_piercing'] }).state()) })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Equip Armor-Piercing Rounds' }))
    expect(onChoose).toHaveBeenCalledWith({ weaponId: 'starter_blaster', bulletId: 'armor_piercing' })
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
