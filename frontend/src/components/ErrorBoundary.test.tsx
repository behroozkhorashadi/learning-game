import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('kaboom')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('All good')).toBeTruthy()
  })

  it('catches a render error, shows a recoverable fallback, and reports it', async () => {
    // React logs the thrown error to console.error during render — expected
    // noise for this test, not a real failure.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response)) as unknown as typeof fetch

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Oops, this game tripped!')).toBeTruthy()
    expect(screen.queryByText('All good')).toBeNull()

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/client-errors',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({ source: 'react-error-boundary', message: 'kaboom' })
  })

  it('"Try again" reloads the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(() => Promise.resolve({ ok: true } as Response)) as unknown as typeof fetch
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { value: { reload }, writable: true })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(reload).toHaveBeenCalled()
  })
})
