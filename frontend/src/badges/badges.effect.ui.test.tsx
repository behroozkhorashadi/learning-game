import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindBadges } from './badges.effect.ui.tsx'
import { BADGES, STATS } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

describe('bindBadges', () => {
  it('loads badges and stats for the profile, then shows them', async () => {
    const asked: number[] = []
    const Badges = bindBadges({
      loadBadges: (id) => {
        asked.push(id)
        return Promise.resolve(BADGES)
      },
      loadStats: () => Promise.resolve(STATS),
      now: () => new Date('2026-01-05T15:00:00Z'),
    })
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('Your badges')).toBeTruthy()
    expect(asked).toEqual([7])
  })

  it('shows the failure when either request fails', async () => {
    const Badges = bindBadges({ loadBadges: () => Promise.resolve(BADGES), loadStats: () => Promise.reject(new Error('GET /api/profiles/7/stats failed with HTTP 500')), now: () => new Date() })
    await act(async () => {
      render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/profiles/7/stats failed with HTTP 500')
  })
})
