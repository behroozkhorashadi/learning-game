import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bindErrorBoundary } from './error_boundary.effect.ui.tsx'

function Bomb(): never {
  throw new Error('kaboom')
}

beforeEach(() => {
  // React logs the caught render error to console.error: expected noise here.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function boundary() {
  const report = vi.fn()
  const reload = vi.fn()
  return { ErrorBoundary: bindErrorBoundary({ report, reload }), report, reload }
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    const { ErrorBoundary, report } = boundary()
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeTruthy()
    expect(report).not.toHaveBeenCalled()
  })

  it('catches a render error, shows a recoverable fallback, and reports it with the component stack', () => {
    const { ErrorBoundary, report } = boundary()
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Oops, this game tripped!')).toBeTruthy()
    expect(report).toHaveBeenCalledWith('react-error-boundary', expect.objectContaining({ message: 'kaboom', componentStack: expect.stringContaining('Bomb') as unknown }))
  })

  it('"Try again" reloads the page', () => {
    const { ErrorBoundary, reload } = boundary()
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalled()
  })
})
