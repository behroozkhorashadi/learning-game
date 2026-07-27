import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { PromptForge } from './PromptForge'
import type { Piece } from '../types/generated'

afterEach(() => cleanup())

function mockFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/pieces' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      const piece: Piece = { id: 'p1', profile_id: body.profile_id, game_id: body.game_id, title: body.title, body: '', word_count: 0, constraints: body.constraints, art_style: body.art_style }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(piece) } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
})

function forgeAllIngredients() {
  fireEvent.click(screen.getByText('a lighthouse keeper'))
  fireEvent.click(screen.getByText('an island in fog'))
  fireEvent.click(screen.getByText('a jar of oil'))
  fireEvent.click(screen.getByText('stubborn'))
}

describe('PromptForge', () => {
  it('walks from forging through the twist into drafting without saving a piece yet', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<PromptForge profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    expect(screen.getByText('The Forge')).toBeTruthy()
    forgeAllIngredients()

    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))

    await waitFor(() => expect(screen.getByText('The Twist')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Flip the twist' }))

    await waitFor(() => expect(screen.getByRole('button', { name: /Start writing/ })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Start writing/ }))

    await waitFor(() => expect(screen.getByText(/You forged a lighthouse keeper/)).toBeTruthy())
    // Entering drafting must not have created a Piece — only finishing the
    // revision pass should (otherwise abandoning here leaves a ghost story).
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls onBack from the forging screen', () => {
    const onBack = vi.fn()
    render(<PromptForge profileId={1} profileName="Mia" onBack={onBack} onFinished={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('keeps you on the forging screen until all four ingredients are picked', () => {
    render(<PromptForge profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    fireEvent.click(screen.getByText('a lighthouse keeper'))
    fireEvent.click(screen.getByRole('button', { name: /Forge it/ }))

    expect(screen.getByText('The Forge')).toBeTruthy()
  })
})
