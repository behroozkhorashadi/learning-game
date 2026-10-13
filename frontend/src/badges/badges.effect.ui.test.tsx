import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { bindBadges } from './badges.effect.ui.tsx'
import { ART, BADGES, STATS } from './badges_fixtures.test.lib.ts'

afterEach(cleanup)

describe('bindBadges', () => {
  it('loads badges, stats, and the art gallery for the profile, then shows them', async () => {
    const asked: number[] = []
    const galleryAsked: number[] = []
    const Badges = bindBadges({
      loadBadges: (id) => {
        asked.push(id)
        return Promise.resolve(BADGES)
      },
      loadStats: () => Promise.resolve(STATS),
      loadGallery: (id) => {
        galleryAsked.push(id)
        return Promise.resolve(ART)
      },
      now: () => new Date('2026-01-05T15:00:00Z'),
    })
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(await screen.findByText('Badges & prizes')).toBeTruthy()
    expect(await screen.findByRole('img', { name: 'Comic Hero: a pet dragon' })).toBeTruthy()
    expect(asked).toEqual([7])
    expect(galleryAsked).toEqual([7])
  })

  it('still shows the badges when only the gallery fails', async () => {
    const Badges = bindBadges({ loadBadges: () => Promise.resolve(BADGES), loadStats: () => Promise.resolve(STATS), loadGallery: () => Promise.reject(new Error('GET /api/profiles/7/armory/art failed with HTTP 500')), now: () => new Date() })
    render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    expect((await screen.findByRole('alert')).textContent).toBe("Your gallery couldn't load (GET /api/profiles/7/armory/art failed with HTTP 500).")
    expect(await screen.findByRole('img', { name: 'Word Wizard' })).toBeTruthy()
  })

  it('shows the failure when either request fails', async () => {
    const Badges = bindBadges({ loadBadges: () => Promise.resolve(BADGES), loadStats: () => Promise.reject(new Error('GET /api/profiles/7/stats failed with HTTP 500')), loadGallery: () => Promise.resolve(ART), now: () => new Date() })
    await act(async () => {
      render(<Badges profileId={7} kidName="Mia" onBack={() => undefined} />)
    })
    expect(screen.getByRole('alert').textContent).toBe('Error: GET /api/profiles/7/stats failed with HTTP 500')
  })
})
