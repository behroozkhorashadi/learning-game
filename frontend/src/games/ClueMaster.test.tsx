import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { ClueMaster } from './ClueMaster'
import type { Piece } from '../types/generated'

afterEach(() => cleanup())

function mockFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/pieces' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      const piece: Piece = { id: 'p1', profile_id: body.profile_id, game_id: body.game_id, title: body.title, body: body.body, word_count: 0, constraints: body.constraints, art_style: body.art_style }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(piece) } as Response)
    }
    if (url === '/api/pieces/p1/revisions' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, piece_id: 'p1', ...body }) } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.restoreAllMocks()
})

const LONG_DRAFT =
  'The house had been quiet all afternoon and nobody thought much of the empty hallway until the rain started outside. ' +
  'Footsteps came and went upstairs but no one answered when called out to twice. ' +
  'By evening the whole family had gathered in the kitchen wondering out loud who had actually been home.'

async function reachRevising() {
  await waitFor(() => expect(screen.getByRole('button', { name: 'Deal my ending' })).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Deal my ending' }))

  await waitFor(() => expect(screen.getByRole('button', { name: 'Start writing →' })).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Start writing →' }))

  await waitFor(() => expect(screen.getByPlaceholderText(/Start anywhere/)).toBeTruthy())
  fireEvent.change(screen.getByPlaceholderText(/Start anywhere/), { target: { value: LONG_DRAFT } })
  fireEvent.click(screen.getByRole('button', { name: 'Let me guess →' }))

  await waitFor(() => expect(screen.getByText('Give me a second…')).toBeTruthy())
}

describe('ClueMaster', () => {
  it('deals a case, drafts, and reaches revising without saving a piece yet', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<ClueMaster profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await reachRevising()
    // Reaching the coach is not "finishing the exercise" — no Piece should be
    // saved until the revision pass completes.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not let the kid guess before writing enough of the lead-up', async () => {
    render(<ClueMaster profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Deal my ending' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Deal my ending' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start writing →' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Start writing →' }))

    await waitFor(() => expect(screen.getByPlaceholderText(/Start anywhere/)).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(/Start anywhere/), { target: { value: 'too short a lead-up' } })
    fireEvent.click(screen.getByRole('button', { name: 'Let me guess →' }))

    expect(screen.getByPlaceholderText(/Start anywhere/)).toBeTruthy()
  })

  it('creates the piece only after the revision pass, then plays through to a verdict', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<ClueMaster profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await reachRevising()
    await waitFor(() => expect(screen.getByRole('button', { name: "I'm happy with it" })).toBeTruthy(), { timeout: 3000 })

    const textarea = screen.getAllByDisplayValue(LONG_DRAFT)[0]
    fireEvent.change(textarea, { target: { value: `${LONG_DRAFT} It never happened again.` } })

    fireEvent.click(screen.getByRole('button', { name: "I'm happy with it" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/pieces', expect.objectContaining({ method: 'POST' })))
    await waitFor(() => expect(screen.getByText('reading it back…')).toBeTruthy())

    await waitFor(() => expect(screen.getByRole('button', { name: 'You got it' })).toBeTruthy(), { timeout: 3000 })
    fireEvent.click(screen.getByRole('button', { name: 'You got it' }))

    expect(screen.getByText('Solved')).toBeTruthy()
  })

  it('calls onBack from the dealing screen', async () => {
    const onBack = vi.fn()
    render(<ClueMaster profileId={1} profileName="Mia" onBack={onBack} onFinished={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
