import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleZombieHorde } from './zombie_horde.assembly.main.ts'

/** The real graph up to the start screen and the armory (the 3D view needs WebGL), with only the network edge replaced. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

const ARMORY = {
  profile_id: 1,
  balance: 42,
  earned: 42,
  spent: 0,
  owned: ['starter_blaster', 'standard_rounds'],
  grenades: 1,
  ammo: { armor_piercing: 0 },
  gems: { reflect_gem: 2 },
  best_survived_ms: 0,
  catalog: [{ id: 'starter_blaster', kind: 'weapon', name: 'Starter Blaster', description: 'Your trusty blaster.', price: 0, quantity: 1, consumable: false, requires: null }],
}

describe('assembleZombieHorde', () => {
  it('opens on the start screen with the armory loaded from the API', async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/api/profiles/1/armory' ? ARMORY : {}), { status: 200 })))
    vi.stubGlobal('fetch', fetch)
    const ZombieHorde = assembleZombieHorde()
    render(<ZombieHorde profileId={1} onBack={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Zombie Horde' })).toBeTruthy()
    expect((await screen.findByRole('status', { name: 'Points' })).textContent).toContain('42')
    expect(fetch).toHaveBeenCalledWith('/api/profiles/1/armory', expect.objectContaining({ method: 'GET' }))
  })
})
