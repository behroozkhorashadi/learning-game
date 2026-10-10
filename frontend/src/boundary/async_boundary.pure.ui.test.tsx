import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { use, type ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AsyncBoundary } from './async_boundary.pure.ui.tsx'

afterEach(cleanup)

function Reads({ value }: { readonly value: Promise<string> }): ReactElement {
  return <p>{use(value)}</p>
}

function Throws(): ReactElement {
  throw new Error('boom')
}

const failed = (error: unknown, retry: () => void): ReactElement => (
  <div role="alert">
    {error instanceof Error ? error.message : 'unknown'}
    <button type="button" onClick={retry}>
      Retry
    </button>
  </div>
)

describe('AsyncBoundary', () => {
  it('shows loading while suspended, then the content', async () => {
    let resolve: (v: string) => void = () => undefined
    const value = new Promise<string>((r) => (resolve = r))
    // React 19 only retries a suspended render inside an awaited act().
    await act(async () => {
      render(
        <AsyncBoundary loading={<p>Loading…</p>} failed={failed}>
          <Reads value={value} />
        </AsyncBoundary>,
      )
    })
    expect(screen.getByText('Loading…')).toBeTruthy()
    await act(async () => {
      resolve('Ready')
    })
    expect(screen.getByText('Ready')).toBeTruthy()
  })

  it('contains a throw and offers retry', () => {
    // React logs caught render errors to console.error; silence that noise for this test only.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <AsyncBoundary loading={null} failed={failed}>
        <Throws />
      </AsyncBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('boom')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(screen.getByRole('alert').textContent).toContain('boom')
    spy.mockRestore()
  })
})
