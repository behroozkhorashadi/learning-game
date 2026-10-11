import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GAMES, LIGHTHOUSE } from './library_fixtures.test.lib.ts'
import { assembleStoryLibrary, assembleStorybookEntryCard } from './story_library.assembly.main.ts'

/** The real graph: assembled screens → pieces adapter → (stubbed) global fetch and confirm. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function serve(remaining: () => unknown) {
  return vi.fn((url: string, init?: RequestInit) => {
    const body = init?.method === 'DELETE' ? null : url === '/api/games' ? GAMES : url.endsWith('/illustrations') ? [] : remaining()
    return Promise.resolve(new Response(body === null ? null : JSON.stringify(body), { status: body === null ? 204 : 200 }))
  })
}

describe('story library assemblies', () => {
  it('lists, confirms with window.confirm, and DELETEs a piece', async () => {
    let pieces: unknown[] = [LIGHTHOUSE]
    const fetchFake = serve(() => pieces)
    vi.stubGlobal('fetch', fetchFake)
    vi.stubGlobal('confirm', () => {
      pieces = []
      return true
    })
    const StoryLibrary = assembleStoryLibrary()
    render(<StoryLibrary profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }))
    expect(await screen.findByText('Your book is waiting for its first story.')).toBeTruthy()
    expect(fetchFake).toHaveBeenCalledWith('/api/pieces/p1', expect.objectContaining({ method: 'DELETE' }))
    expect(fetchFake).toHaveBeenCalledWith('/api/pieces?profile_id=1', expect.objectContaining({ method: 'GET' }))
  })

  it('the entry card reads the same pieces', async () => {
    vi.stubGlobal('fetch', serve(() => [LIGHTHOUSE]))
    const Card = assembleStorybookEntryCard()
    render(<Card profileId={1} onOpen={vi.fn()} />)
    expect(await screen.findByText('1 story')).toBeTruthy()
  })
})
