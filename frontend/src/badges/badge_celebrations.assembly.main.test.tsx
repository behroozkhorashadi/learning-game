import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleBadgeCelebrations } from './badge_celebrations.assembly.main.ts'
import { JUST_EARNED } from './badges_fixtures.test.lib.ts'

/** The real graph: assembled celebrations → badges adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleBadgeCelebrations', () => {
  it('reads the new badges and marks one celebrated', async () => {
    const fetchFake = vi.fn((url: string) => Promise.resolve(url.endsWith('/celebrated') ? new Response(null, { status: 204 }) : new Response(JSON.stringify([JUST_EARNED]), { status: 200 })))
    vi.stubGlobal('fetch', fetchFake)
    const Celebrations = assembleBadgeCelebrations()
    render(<Celebrations profileId={2} mode="party" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Awesome!' }))
    await waitFor(() => {
      expect(fetchFake.mock.calls.map(([url]) => url)).toEqual(['/api/profiles/2/badges/new', '/api/profiles/2/badges/streak-3/celebrated'])
    })
  })
})
