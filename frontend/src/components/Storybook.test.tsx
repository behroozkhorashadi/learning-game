import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { Storybook } from './Storybook'
import type { Piece, Illustration, GameMetadata } from '../types/generated'

afterEach(() => cleanup())

const GAMES: GameMetadata[] = [{ id: 'syllable_builder', title: 'Syllable Builder', tagline: '', skill_ids: [], min_age: 5, max_age: 8, icon: '🧩', max_level: 10 }]

function mockFetch(pieces: Piece[], illustrationsByPiece: Record<string, Illustration[]> = {}) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/pieces?')) return Promise.resolve({ ok: true, json: () => Promise.resolve(pieces) } as Response)
    if (url === '/api/games') return Promise.resolve({ ok: true, json: () => Promise.resolve(GAMES) } as Response)
    if (init?.method === 'DELETE' && /^\/api\/pieces\/(.+)$/.test(url)) return Promise.resolve({ ok: true } as Response)
    const match = url.match(/^\/api\/pieces\/(.+)\/illustrations$/)
    if (match) return Promise.resolve({ ok: true, json: () => Promise.resolve(illustrationsByPiece[match[1]] ?? []) } as Response)
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch([]))
})

describe('Storybook', () => {
  it('shows the empty shelf when there are no pieces', async () => {
    render(<Storybook profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your book is waiting for its first story.')).toBeTruthy())
  })

  it('lists pieces on the shelf and opens the reader on click', async () => {
    const piece: Piece = {
      id: 'p1',
      profile_id: 1,
      game_id: 'syllable_builder',
      title: 'The Ninety-Six Steps',
      body: 'The lighthouse had been dark for eleven years.',
      word_count: 8,
      constraints: ['a lighthouse'],
      art_style: 'storybook',
      created_at: '2026-01-01T00:00:00Z',
    }
    vi.stubGlobal('fetch', mockFetch([piece]))

    render(<Storybook profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('1 story so far')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'The Ninety-Six Steps' }))

    await waitFor(() => expect(screen.getByText('The lighthouse had been dark for eleven years.')).toBeTruthy())
    expect(screen.getByText('Shelf')).toBeTruthy()
  })

  it('deletes a piece from the shelf after confirming', async () => {
    const piece: Piece = {
      id: 'p1',
      profile_id: 1,
      game_id: 'syllable_builder',
      title: 'The Ninety-Six Steps',
      body: 'The lighthouse had been dark for eleven years.',
      word_count: 8,
      constraints: ['a lighthouse'],
      art_style: 'storybook',
      created_at: '2026-01-01T00:00:00Z',
    }
    const fetchMock = mockFetch([piece])
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => true))

    render(<Storybook profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('1 story so far')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pieces/p1', { method: 'DELETE' }))
    await waitFor(() => expect(screen.getByText('Your book is waiting for its first story.')).toBeTruthy())
  })

  it('does not delete a piece when the confirmation is declined', async () => {
    const piece: Piece = {
      id: 'p1',
      profile_id: 1,
      game_id: 'syllable_builder',
      title: 'The Ninety-Six Steps',
      body: 'The lighthouse had been dark for eleven years.',
      word_count: 8,
      constraints: ['a lighthouse'],
      art_style: 'storybook',
      created_at: '2026-01-01T00:00:00Z',
    }
    const fetchMock = mockFetch([piece])
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('confirm', vi.fn(() => false))

    render(<Storybook profileId={1} profileName="Mia" onBack={vi.fn()} onWriteNew={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('1 story so far')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Delete/ }))

    expect(window.confirm).toHaveBeenCalled()
    expect(screen.getByText('1 story so far')).toBeTruthy()
  })

  it('calls onBack when the top-level back button is clicked', async () => {
    const onBack = vi.fn()
    render(<Storybook profileId={1} profileName="Mia" onBack={onBack} onWriteNew={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Your book is waiting for its first story.')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(onBack).toHaveBeenCalled()
  })
})
