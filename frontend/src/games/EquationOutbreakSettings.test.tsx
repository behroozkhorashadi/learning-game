import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { EquationOutbreakSettings } from './EquationOutbreakSettings'
import type { PracticeConfig } from '../types/generated'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockFetch(config: PracticeConfig | null) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('/api/practice-config') && (!init || init.method === undefined)) {
      if (config == null) return Promise.resolve({ ok: false, status: 404 } as Response)
      return Promise.resolve({ ok: true, json: async () => config } as Response)
    }
    if (url.startsWith('/api/practice-config') && init?.method === 'PUT') {
      return Promise.resolve({ ok: true, json: async () => JSON.parse(init.body as string) } as Response)
    }
    if (url.startsWith('/api/practice-config') && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 204 } as Response)
    }
    throw new Error(`unexpected fetch: ${url} ${init?.method}`)
  }) as unknown as typeof fetch
}

describe('EquationOutbreakSettings — discoverability regression', () => {
  it('renders the operation/focus/difficulty controls even with no saved config, just inert', async () => {
    mockFetch(null)
    render(<EquationOutbreakSettings profileId={2} onBack={vi.fn()} />)

    // Regression guard: these used to be conditionally rendered ({customEnabled
    // && (...)}), so they were entirely absent from the DOM until the checkbox
    // was checked — easy to miss because there was no visual hint anything was
    // hidden. They must now always be present (just visually inert, which is
    // also why these queries need `hidden: true` — aria-hidden correctly
    // excludes them from the default accessibility-tree query).
    await screen.findByText('Operations')
    expect(screen.getByRole('button', { name: '×', hidden: true })).toBeTruthy()
    expect(screen.getByText(/Difficulty/)).toBeTruthy()

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(false)

    const controlsWrapper = screen.getByText('Operations').closest('[aria-hidden]')
    expect(controlsWrapper?.getAttribute('aria-hidden')).toBe('true')
  })

  it('checking the box marks the controls as no longer inert', async () => {
    mockFetch(null)
    render(<EquationOutbreakSettings profileId={2} onBack={vi.fn()} />)

    await screen.findByText('Operations')
    fireEvent.click(screen.getByRole('checkbox'))

    const controlsWrapper = screen.getByText('Operations').closest('[aria-hidden]')
    expect(controlsWrapper?.getAttribute('aria-hidden')).toBe('false')
  })
})

describe('EquationOutbreakSettings — operations', () => {
  it('never allows deselecting the last remaining operation', async () => {
    mockFetch(null)
    render(<EquationOutbreakSettings profileId={2} onBack={vi.fn()} />)
    await screen.findByText('Operations')
    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '-' }))
    // Drop to a single operation (×), then try to drop the last one too.
    fireEvent.click(screen.getByRole('button', { name: '÷' }))
    fireEvent.click(screen.getByRole('button', { name: '×' })) // should be a no-op — × is the last one left

    expect(screen.getByText(/Focus numbers for multiplication/)).toBeTruthy()
  })

  it('shows a focus-number section only for active operations', async () => {
    mockFetch(null)
    render(<EquationOutbreakSettings profileId={2} onBack={vi.fn()} />)
    await screen.findByText('Operations')
    fireEvent.click(screen.getByRole('checkbox'))

    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '-' }))
    fireEvent.click(screen.getByRole('button', { name: '÷' }))

    expect(screen.queryByText(/Focus numbers for addition/)).toBeNull()
    expect(screen.queryByText(/Focus numbers for subtraction/)).toBeNull()
    expect(screen.queryByText(/Focus numbers for division/)).toBeNull()
    expect(screen.getByText(/Focus numbers for multiplication/)).toBeTruthy()
  })
})

describe('EquationOutbreakSettings — loading an existing config', () => {
  it('prefills fields and starts checked', async () => {
    const existing: PracticeConfig = {
      id: 1,
      profile_id: 2,
      game_id: 'fact_fluency',
      operations: ['×'],
      focus_numbers: { '×': [7, 8] },
      difficulty: 8,
    }
    mockFetch(existing)
    render(<EquationOutbreakSettings profileId={2} onBack={vi.fn()} />)

    await screen.findByText('Operations')
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: '×' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '7' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '8' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/8\/10/)).toBeTruthy()
  })
})

describe('EquationOutbreakSettings — saving', () => {
  it('PUTs the selected operations, focus numbers, and difficulty', async () => {
    mockFetch(null)
    const onBack = vi.fn()
    render(<EquationOutbreakSettings profileId={2} onBack={onBack} />)

    await screen.findByText('Operations')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: '+' }))
    fireEvent.click(screen.getByRole('button', { name: '-' }))
    fireEvent.click(screen.getByRole('button', { name: '÷' }))
    fireEvent.click(screen.getByRole('button', { name: '7' }))
    fireEvent.click(screen.getByRole('button', { name: '8' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onBack).toHaveBeenCalled())
    const putCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
    )
    const putInit = putCall?.[1] as RequestInit
    expect(JSON.parse(putInit.body as string)).toMatchObject({
      profile_id: 2,
      game_id: 'fact_fluency',
      operations: ['×'],
      focus_numbers: { '×': [7, 8] },
    })
  })

  it('DELETEs when turning custom focus off after it was previously on', async () => {
    const existing: PracticeConfig = {
      id: 1,
      profile_id: 2,
      game_id: 'fact_fluency',
      operations: ['×'],
      focus_numbers: {},
      difficulty: 5,
    }
    mockFetch(existing)
    const onBack = vi.fn()
    render(<EquationOutbreakSettings profileId={2} onBack={onBack} />)

    await screen.findByText('Operations')
    fireEvent.click(screen.getByRole('checkbox')) // turn custom focus back off

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onBack).toHaveBeenCalled())
    const deleteCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
    )
    expect(deleteCall).toBeTruthy()
  })
})
