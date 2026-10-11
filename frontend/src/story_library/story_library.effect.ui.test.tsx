import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakePiecesStore, LIGHTHOUSE, type FakePiecesStore } from './library_fixtures.test.lib.ts'
import { loadLibrary } from './library_loader.pure.lib.ts'
import { DELETE_QUESTION, bindStoryLibrary } from './story_library.effect.ui.tsx'

afterEach(cleanup)

function renderLibrary(store: FakePiecesStore, answer: boolean) {
  const confirm = vi.fn((_message: string) => answer)
  const StoryLibrary = bindStoryLibrary({ loadLibrary: (id) => loadLibrary(store, id), removePiece: store.remove, confirm })
  render(<StoryLibrary profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)
  return confirm
}

describe('bindStoryLibrary', () => {
  it('deletes a piece after confirming, then shows the re-read shelf', async () => {
    const store = fakePiecesStore([LIGHTHOUSE])
    const confirm = renderLibrary(store, true)
    expect(await screen.findByText('1 story so far')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))
    expect(confirm).toHaveBeenCalledWith(DELETE_QUESTION)
    expect(await screen.findByText('Your book is waiting for its first story.')).toBeTruthy()
    expect(store.removed).toEqual(['p1'])
  })

  it('does not delete when the confirmation is declined', async () => {
    const store = fakePiecesStore([LIGHTHOUSE])
    renderLibrary(store, false)
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }))
    expect(store.removed).toEqual([])
    expect(screen.getByText('1 story so far')).toBeTruthy()
  })

  it('shows why a delete failed and keeps the piece', async () => {
    renderLibrary(fakePiecesStore([LIGHTHOUSE], {}, { remove: 'DELETE /api/pieces/p1 failed with HTTP 500' }), true)
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('Error: DELETE /api/pieces/p1 failed with HTTP 500')
    expect(screen.getByText('1 story so far')).toBeTruthy()
  })
})
