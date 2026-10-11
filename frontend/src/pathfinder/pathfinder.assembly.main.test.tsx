import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assemblePathfinder, assemblePathfinderLevelGallery, assemblePathfinderMapBuilder } from './pathfinder.assembly.main.ts'
import { ALL_LEVELS } from './pathfinder_levels.pure.lib.ts'

/** The real graph: assembled screens → Pathfinder adapter → (stubbed) global fetch. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function respond(body: unknown): Promise<Response> {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}

describe('assemblePathfinder', () => {
  it("loads the profile's completions and saved maps from the API and shows the level map", async () => {
    const fetchFake = vi.fn((url: string) => (url.endsWith('/completions') ? respond(['custom-x']) : respond([])))
    vi.stubGlobal('fetch', fetchFake)
    const Pathfinder = assemblePathfinder()
    render(<Pathfinder profileId={4} onBack={vi.fn()} />)
    expect(await screen.findByText(`0 / ${String(ALL_LEVELS.length)} maps completed`)).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles/4/pathfinder/completions', expect.objectContaining({ method: 'GET' }))
    expect(fetchFake).toHaveBeenCalledWith('/api/profiles/4/pathfinder/maps', expect.objectContaining({ method: 'GET' }))
  })

  it('shows a load failure when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))))
    const Pathfinder = assemblePathfinder()
    render(<Pathfinder profileId={4} onBack={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Couldn't load your progress/)
  })
})

describe('assemblePathfinderMapBuilder', () => {
  it('opens the saved-map library over the API', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond([])))
    const MapBuilder = assemblePathfinderMapBuilder()
    render(<MapBuilder profileId={1} username="mia" />)
    fireEvent.click(screen.getByRole('button', { name: 'My Maps' }))
    expect(await screen.findByText(/No saved maps yet/)).toBeTruthy()
  })
})

describe('assemblePathfinderLevelGallery', () => {
  it('renders every curated level without touching the network', () => {
    const fetchFake = vi.fn()
    vi.stubGlobal('fetch', fetchFake)
    const LevelGallery = assemblePathfinderLevelGallery()
    render(<LevelGallery />)
    expect(screen.getByText(/Dev QA — every level unlocked/)).toBeTruthy()
    expect(fetchFake).not.toHaveBeenCalled()
  }, 20_000)
})
