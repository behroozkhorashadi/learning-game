import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleBadges } from './badges.assembly.main.ts'
import { BADGES, STATS } from './badges_fixtures.test.lib.ts'

/** The real graph: assembled screen → badges adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleBadges', () => {
  it('reads /badges and /stats for the profile', async () => {
    const fetchFake = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/badges') ? BADGES : STATS), { status: 200 })))
    vi.stubGlobal('fetch', fetchFake)
    const Badges = assembleBadges()
    render(<Badges profileId={1} kidName="Mia" onBack={vi.fn()} />)
    expect(await screen.findByText('Your badges')).toBeTruthy()
    expect(fetchFake.mock.calls.map(([url]) => url).sort()).toEqual(['/api/profiles/1/badges', '/api/profiles/1/stats'])
  })
})
