import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assembleErrorHandling } from './errors.assembly.main.ts'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('assembleErrorHandling', () => {
  it('reports a caught render error to the backend', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchFake = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })))
    vi.stubGlobal('fetch', fetchFake)
    const { ErrorBoundary } = assembleErrorHandling()
    function Bomb(): never {
      throw new Error('kaboom')
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Oops, this game tripped!')).toBeTruthy()
    await vi.waitFor(() => {
      expect(fetchFake).toHaveBeenCalledWith('/api/client-errors', expect.objectContaining({ method: 'POST' }))
    })
  })
})
