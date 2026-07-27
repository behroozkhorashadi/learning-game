import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { TagTeamStory } from './TagTeamStory'
import type { Piece } from '../types/generated'

afterEach(() => cleanup())

function mockFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/pieces' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      const piece: Piece = { id: 'p1', profile_id: body.profile_id, game_id: body.game_id, title: body.title, body: '', word_count: 0, constraints: body.constraints, art_style: body.art_style }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(piece) } as Response)
    }
    if (url === '/api/pieces/p1/turns' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, piece_id: 'p1', ...body }) } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
})

async function playFourLineGame() {
  fireEvent.click(screen.getByRole('button', { name: '4 lines' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ghost story' }))
  fireEvent.click(screen.getByRole('button', { name: "I'll start us off →" }))

  // AI's first line (turn 1 of 4)
  await waitFor(() => expect(screen.getByPlaceholderText(/One or two sentences is plenty/)).toBeTruthy(), { timeout: 3000 })

  // kid's line (turn 2 of 4)
  fireEvent.change(screen.getByPlaceholderText(/One or two sentences is plenty/), {
    target: { value: 'I pressed it because nobody was watching the hallway.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Pass it back →' }))

  // AI's second line (turn 3 of 4)
  await waitFor(() => expect(screen.getByPlaceholderText(/One or two sentences is plenty/)).toBeTruthy(), { timeout: 3000 })

  // kid's second line (turn 4 of 4) -> should reach assembly
  fireEvent.change(screen.getByPlaceholderText(/One or two sentences is plenty/), {
    target: { value: 'I knocked back twice and the hallway went completely silent.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Pass it back →' }))

  await waitFor(() => expect(screen.getByText('The Eighth Floor')).toBeTruthy(), { timeout: 3000 })
}

describe('TagTeamStory', () => {
  it('plays a full four-line game to the assembly screen without saving a piece yet', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<TagTeamStory profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await playFourLineGame()
    expect(screen.getByText('4 lines, one story')).toBeTruthy()
    // kid wrote 19 of the 50 total words across the four fixed lines -> 38%.
    expect(screen.getByText('38%')).toBeTruthy()
    // Reaching assembly is not "finishing the exercise" — no Piece should be
    // saved until the revision pass completes (otherwise abandoning here
    // leaves a ghost story on the shelf).
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not let the kid pass back a line that is too short', async () => {
    render(<TagTeamStory profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '4 lines' }))
    fireEvent.click(screen.getByRole('button', { name: "I'll start us off →" }))

    await waitFor(() => expect(screen.getByPlaceholderText(/One or two sentences is plenty/)).toBeTruthy(), { timeout: 3000 })
    fireEvent.change(screen.getByPlaceholderText(/One or two sentences is plenty/), { target: { value: 'too short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pass it back →' }))

    expect(screen.getByPlaceholderText(/One or two sentences is plenty/)).toBeTruthy()
  })

  it('calls onBack from the setup screen', async () => {
    const onBack = vi.fn()
    render(<TagTeamStory profileId={1} profileName="Mia" onBack={onBack} onFinished={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
