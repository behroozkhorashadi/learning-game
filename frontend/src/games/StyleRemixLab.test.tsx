import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { StyleRemixLab } from './StyleRemixLab'
import type { Piece } from '../types/generated'

afterEach(() => cleanup())

function mockFetch() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/pieces' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      const piece: Piece = { id: 'p1', profile_id: body.profile_id, game_id: body.game_id, title: body.title, body: '', word_count: 0, constraints: body.constraints, art_style: body.art_style }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(piece) } as Response)
    }
    if (url === '/api/pieces/p1/remixes' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string)
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 1, piece_id: 'p1', ...body }) } as Response)
    }
    return Promise.reject(new Error(`unexpected fetch ${url}`))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch())
})

async function writeAndShelveAVersion() {
  await waitFor(() => expect(screen.getByText('Draw a style')).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Draw a style' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start writing' })).toBeTruthy())
  fireEvent.click(screen.getByRole('button', { name: 'Start writing' }))

  await waitFor(() => expect(screen.getByPlaceholderText('Start with the gate. Or the rain. Anywhere.')).toBeTruthy())
  fireEvent.change(screen.getByPlaceholderText('Start with the gate. Or the rain. Anywhere.'), {
    target: { value: 'The gate creaked open in the storm and something small slipped away into the dark rain.' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Put it on the shelf' }))
  await waitFor(() => expect(screen.getByText('Same scene, 1 ways')).toBeTruthy())
}

describe('StyleRemixLab', () => {
  it('draws a style, writes a remix, and shelves it without saving a piece yet', async () => {
    const fetchMock = mockFetch()
    vi.stubGlobal('fetch', fetchMock)
    render(<StyleRemixLab profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await writeAndShelveAVersion()
    expect(screen.getByText('Same scene, 1 ways')).toBeTruthy()
    expect(screen.getByText('Draw another style')).toBeTruthy()
    // Drawing, writing, and shelving a version is not "finishing the
    // exercise" — no Piece should be saved until the revision pass completes.
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('requires at least two versions before polishing a favourite', async () => {
    render(<StyleRemixLab profileId={1} profileName="Mia" onBack={vi.fn()} onFinished={vi.fn()} />)

    await writeAndShelveAVersion()
    fireEvent.click(screen.getByRole('button', { name: /Pick this/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Polish my favourite' }))

    expect(screen.getByText('Same scene, 1 ways')).toBeTruthy()
  })

  it('calls onBack from the drawing screen', async () => {
    const onBack = vi.fn()
    render(<StyleRemixLab profileId={1} profileName="Mia" onBack={onBack} onFinished={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Draw a style')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalled()
  })
})
