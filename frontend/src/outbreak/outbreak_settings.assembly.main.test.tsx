import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleOutbreakSettings } from './outbreak_settings.assembly.main.ts'

/** The real graph: the settings screen over the practice-config adapter, with only the network stubbed. */

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('assembleOutbreakSettings', () => {
  it('loads with a GET and saves with a PUT', async () => {
    const fetchFake = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(init?.method === 'GET' ? new Response(null, { status: 404 }) : new Response(null, { status: 204 })),
    )
    vi.stubGlobal('fetch', fetchFake)
    const OutbreakSettings = assembleOutbreakSettings()
    const onBack = vi.fn()
    render(<OutbreakSettings profileId={4} onBack={onBack} />)
    await act(async () => undefined)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(onBack).toHaveBeenCalled()
    })
    expect(fetchFake.mock.calls.map(([url, init]) => `${init?.method ?? ''} ${url}`)).toEqual(['GET /api/practice-config?profile_id=4&game_id=fact_fluency', 'PUT /api/practice-config'])
  })
})
